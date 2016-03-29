/* Player for module formats supported by libopenmpt */

(function() {
	function OpenMPTGenerator(url, audioCtx) {
		var modulePtr, leftBufferPtr, rightBufferPtr;
		var maxFramesPerChunk = 4096;
		var self = this;

		function initModule(data) {
			var byteArray = new Int8Array(data);
			var ptrToFile = Module._malloc(byteArray.byteLength);
			Module.HEAPU8.set(byteArray, ptrToFile);

			modulePtr = Module._openmpt_module_create_from_memory(ptrToFile, byteArray.byteLength, 0, 0, 0);
			leftBufferPtr  = Module._malloc(4 * maxFramesPerChunk);
			rightBufferPtr = Module._malloc(4 * maxFramesPerChunk);

			self.duration = Module._openmpt_module_get_duration_seconds(modulePtr);
		}

		this.cleanup = function() {
			if (modulePtr) {
				Module._openmpt_module_destroy(modulePtr);
			}
			if (leftBufferPtr) {
				Module._free(leftBufferPtr);
			}
			if (rightBufferPtr) {
				Module._free(rightBufferPtr);
			}
		};

		this.load = function(onReady) {
			this.channelCount = 2;

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
		};

		this.generateAudio = function(outputBuffer) {
			var outputL = outputBuffer.getChannelData(0);
			var outputR = outputBuffer.getChannelData(1);
			var framesToRender = outputBuffer.length;

			var framesRendered = 0;
			var ended = false;
			while (framesToRender > 0) {
				var framesPerChunk = Math.min(framesToRender, maxFramesPerChunk);
				var actualFramesPerChunk = Module._openmpt_module_read_float_stereo(modulePtr, audioCtx.sampleRate, framesPerChunk, leftBufferPtr, rightBufferPtr);
				var rawAudioLeft = Module.HEAPF32.subarray(leftBufferPtr / 4, leftBufferPtr / 4 + actualFramesPerChunk);
				var rawAudioRight = Module.HEAPF32.subarray(rightBufferPtr / 4, rightBufferPtr / 4 + actualFramesPerChunk);
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

		this.seek = function(position) {
			Module._openmpt_module_set_position_seconds(modulePtr, position);
		};
	}
	Cowbell.Player.OpenMPT = function() {
		return new Cowbell.Common.WebAudioPlayer(OpenMPTGenerator);
	};
})();
