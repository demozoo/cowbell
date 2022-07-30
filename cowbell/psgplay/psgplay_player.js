/* SNDH player (Atari ST) using https://github.com/frno7/psgplay */

(function() {
	function PSGPlayGenerator(url, audioCtx, playerOpts, trackOpts) {
		var psgplayPtr, bufferPtr;
		var maxFramesPerChunk = 4096;
		var self = this;
		var bufferPtr, decrunchedBytes;
		if (!playerOpts) playerOpts = {};
		if (!trackOpts) trackOpts = {};

		function initSNDH(data) {
			var byteArray = new Int8Array(data);
			var track = trackOpts.track;
			bufferPtr = libpsgplay._malloc(maxFramesPerChunk*4); 

			self.duration=0;
			decrunchedBytes=0;
			var longPtr = libpsgplay._malloc(4); 
			if(Module.ccall('ice_identify',
			  'number',
			  ['array','number'],
			  [byteArray, byteArray.byteLength])){ // arguments
				var s = Module.ccall('ice_decrunched_size','number',['array','number'],[byteArray, byteArray.byteLength]);
				decrunchedBytes = libpsgplay._malloc(s); 

				if (Module.ccall('ice_decrunch','number',['number','array','number'],[decrunchedBytes, byteArray, byteArray.byteLength]) == -1) {
					console.log("ICE decrunch failed\n");
					return;
				}
				if(!trackOpts.track){
					if(libpsgplay._sndh_tag_default_subtune(longPtr,decrunchedBytes,s)){
						trackOpts.track=libpsgplay.HEAP32[longPtr/4];
					}else{
						trackOpts.track=1;
					}
				}
				if(libpsgplay._sndh_tag_subtune_time(longPtr,trackOpts.track,decrunchedBytes,s)){
					self.duration=libpsgplay.HEAPF32.subarray(longPtr/4 , longPtr/4 + 1)[0];
				}
				psgplayPtr = libpsgplay._psgplay_init(decrunchedBytes, s, trackOpts.track, audioCtx.sampleRate);
			} else{
				if(!trackOpts.track){
					if(Module.ccall('sndh_tag_default_subtune','boolean',['number','array','number'],[longPtr,byteArray, byteArray.byteLength])){
						trackOpts.track=libpsgplay.HEAP32[longPtr/4];
					}else{
						trackOpts.track=1;
					}
				}
				if(Module.ccall('sndh_tag_subtune_time','boolean',['number','number','array','number'],[longPtr,trackOpts.track,byteArray, byteArray.byteLength])){
					self.duration=libpsgplay.HEAPF32.subarray(longPtr/4 , longPtr/4 + 1)[0];
				}
				psgplayPtr = Module.ccall('psgplay_init','number',['array','number','number','number'],[byteArray, byteArray.byteLength, trackOpts.track, audioCtx.sampleRate]);
			}
			if (longPtr) {
				libpsgplay._free(longPtr);
			} 
		}

		function ensureLibPSGPlay(onReady) {
			if (!playerOpts.pathToLibPSGPlay) {
				throw "pathToLibPSGPlay not specified";
			}

			if (window.libpsgplay && window.libpsgplay._psgplay_init) {
				/* libopenmpt already loaded */
				onReady();
			} else {
				/* load libopenmpt via <script> tag injection */
				var head = document.getElementsByTagName("head")[0];
				var script = document.createElement("script");
				script.src = playerOpts.pathToLibPSGPlay;

				window.libpsgplay = {
					onRuntimeInitialized: function() {
						onReady();
						head.removeChild(script);
					}
				};

				head.appendChild(script);
			}
		}

		this.cleanup = function() {
			if (psgplayPtr) {
				libpsgplay._psgplay_free(psgplayPtr);
			}
			if (bufferPtr) {
				libpsgplay._free(bufferPtr);
			} 
			if (decrunchedBytes) {
				libpsgplay._free(decrunchedBytes);
			} 
		};

		this.load = function(onReady) {
			var self = this;
			ensureLibPSGPlay(function() {
				self.channelCount = 2;

				var request = new XMLHttpRequest();

				request.addEventListener('error', function(e) {
					console.log('XHR error', e);
				});

				request.addEventListener('load', function(e) {
					data = request.response;
					initSNDH(data);
					onReady();
				});

				/* trigger XHR */
				request.open('GET', url, true);
				request.responseType = "arraybuffer";
				request.send();
			});
		};

		this.generateAudio = function(outputBuffer) {
			var outputL = outputBuffer.getChannelData(0);
			var outputR = outputBuffer.getChannelData(1); 
			var framesToRender = outputBuffer.length;

			var framesRendered = 0;
			var ended = false;
			while (framesToRender > 0) {
				var framesPerChunk = Math.min(framesToRender, maxFramesPerChunk);
				var actualFramesPerChunk=Module.ccall('psgplay_read_stereo','number',['number','number','number'],[psgplayPtr, bufferPtr, framesPerChunk]);
				var rawAudio = libpsgplay.HEAP16.subarray(bufferPtr/2 , bufferPtr/2 + actualFramesPerChunk*2); 
				for (var i = 0; i < actualFramesPerChunk; ++i) {
					outputL[framesRendered + i] = (rawAudio[i*2])/0x8000;
					outputR[framesRendered + i] = (rawAudio[i*2+1])/0x8000;
				}
				framesToRender -= actualFramesPerChunk;
				framesRendered += actualFramesPerChunk;
				if (actualFramesPerChunk < framesPerChunk) {
					break;
				}
			}
			return framesRendered;
		};

		this.seekable = true;

		this.seek = function(position) {
		};

		this.reset = function() {
			this.seek(0);
		}
	}
	Cowbell.Player.PSGPlay = function(opts) {
		return new Cowbell.Common.WebAudioPlayer(PSGPlayGenerator, opts);
	};
})();
