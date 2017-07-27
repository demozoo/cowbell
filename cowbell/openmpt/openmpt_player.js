/* Player for module formats supported by libopenmpt */

(function() {
	function OpenMPTGenerator(url, audioCtx, playerOpts, trackOpts) {
		var modulePtr, leftBufferPtr, rightBufferPtr;
		var maxFramesPerChunk = 4096;
		var self = this;
		if (!playerOpts) playerOpts = {};
		if (!trackOpts) trackOpts = {};

		function initModule(data) {
			var byteArray = new Int8Array(data);
			var ptrToFile = libopenmpt._malloc(byteArray.byteLength);
			libopenmpt.HEAPU8.set(byteArray, ptrToFile);

			modulePtr = libopenmpt._openmpt_module_create_from_memory(ptrToFile, byteArray.byteLength, 0, 0, 0);
			leftBufferPtr  = libopenmpt._malloc(4 * maxFramesPerChunk);
			rightBufferPtr = libopenmpt._malloc(4 * maxFramesPerChunk);

			self.duration = libopenmpt._openmpt_module_get_duration_seconds(modulePtr);
		}

		function ensureLibOpenMPT(onReady) {
			if (!playerOpts.pathToLibOpenMPT) {
				throw "pathToLibOpenMPT not specified";
			}

			if (window.libopenmpt && window.libopenmpt._openmpt_module_create_from_memory) {
				/* libopenmpt already loaded */
				onReady();
			} else {
				/* load libopenmpt via <script> tag injection */
				var head = document.getElementsByTagName("head")[0];
				var script = document.createElement("script");
				script.src = playerOpts.pathToLibOpenMPT;

				window.libopenmpt = {
					memoryInitializerPrefixURL: playerOpts.pathToLibOpenMPT.replace(/[^/]+$/, '')
				};

				var done = false;

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function(){
					if (
						!done && (
							!this.readyState || this.readyState == "loaded" || this.readyState == "complete"
						)
					) {
						done = true;
						onReady();
						head.removeChild(script);
					}
				};

				head.appendChild(script);
			}
		}

		this.cleanup = function() {
			if (modulePtr) {
				libopenmpt._openmpt_module_destroy(modulePtr);
			}
			if (leftBufferPtr) {
				libopenmpt._free(leftBufferPtr);
			}
			if (rightBufferPtr) {
				libopenmpt._free(rightBufferPtr);
			}
		};

		this.load = function(onReady) {
			var self = this;
			ensureLibOpenMPT(function() {
				self.channelCount = 2;

				var request = new XMLHttpRequest();

				request.addEventListener('error', function(e) {
					console.log('XHR error', e);
				});

				request.addEventListener('load', function(e) {
					data = request.response;
					initModule(data);
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
				var actualFramesPerChunk = libopenmpt._openmpt_module_read_float_stereo(modulePtr, audioCtx.sampleRate, framesPerChunk, leftBufferPtr, rightBufferPtr);
				var rawAudioLeft = libopenmpt.HEAPF32.subarray(leftBufferPtr / 4, leftBufferPtr / 4 + actualFramesPerChunk);
				var rawAudioRight = libopenmpt.HEAPF32.subarray(rightBufferPtr / 4, rightBufferPtr / 4 + actualFramesPerChunk);
				for (var i = 0; i < actualFramesPerChunk; ++i) {
					outputL[framesRendered + i] = rawAudioLeft[i];
					outputR[framesRendered + i] = rawAudioRight[i];
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
			libopenmpt._openmpt_module_set_position_seconds(modulePtr, position);
		};

		this.reset = function() {
			this.seek(0);
		}
	}
	Cowbell.Player.OpenMPT = function(opts) {
		return new Cowbell.Common.WebAudioPlayer(OpenMPTGenerator, opts);
	};
})();
