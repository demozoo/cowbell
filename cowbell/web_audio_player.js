/*
Wrapper to allow Web Audio createScriptProcessor-based player routines to expose
a subset of the HTML5 Media Element API.

This wrapper handles the details of buffering, pausing, and keeping track of current play time.
Inner routines only need to implement a simple 'generator' API consisting of filling a buffer
with audio data, and seeking to a specified time.
*/

(function() {
	var audioCtx;
	Cowbell.Common.WebAudioPlayer = function(generatorConstructor, playerOpts) {
		this.Track = function(url, trackOpts) {
			var generator;

			this.open = function() {
				var self = {};

				if (!audioCtx) {
					var AudioContext = window.AudioContext || window.webkitAudioContext;
					audioCtx = new AudioContext();
				}

				var BUFFER_SIZE = 4096;

				self.HAVE_NOTHING = 0;
				self.HAVE_METADATA = 1;
				self.HAVE_CURRENT_DATA = 2;
				self.HAVE_FUTURE_DATA = 3;
				self.HAVE_ENOUGH_DATA = 4;
				self.readyState = self.HAVE_NOTHING;

				generator = new generatorConstructor(url, audioCtx, playerOpts, trackOpts);
				var generatorIsReady = false;
				var playWasRequestedBeforeReady = false;
				var scriptNode;

				var hasStartedProcessing = false;
				var playFromTime = 0;
				var playStartTimestamp;
				self.paused = true;

				generator.load(function() {
					generatorIsReady = true;
					self.readyState = self.HAVE_ENOUGH_DATA;
					self.duration = generator.duration;
					seek(0);
					if (self.onloadedmetadata) self.onloadedmetadata();
					if (playWasRequestedBeforeReady) self.play();
				});

				function seek(newTime) {
					if (scriptNode) scriptNode.disconnect(0);
					generator.seek(newTime);
					playFromTime = newTime;
					hasStartedProcessing = false;
					scriptNode = audioCtx.createScriptProcessor(BUFFER_SIZE, 0, generator.channelCount);
					scriptNode.onaudioprocess = generateAudio;
					if (!self.paused) {
						self.paused = true;
						self.play();
					}
				}

				function generateAudio(event) {
					if (!hasStartedProcessing) {
						playStartTimestamp = event.playbackTime;
						hasStartedProcessing = true;
					}

					var generatedLength = generator.generateAudio(event.outputBuffer);

					if (generatedLength < event.outputBuffer.length) {
						/* generate silence for the remainder of the buffer */
						for (var chan = 0; chan < event.outputBuffer.numberOfChannels; chan++) {
							var channelData = event.outputBuffer.getChannelData(chan);
							for (var i = generatedLength; i < event.outputBuffer.length; i++) {
								channelData[i] = 0;
							}
						}

						if (self.currentTime > self.duration) {
							/* we've finished playing (not just generating) the audio */
							self.pause();
							if (self.onended) self.onended();
							seek(0);
						}
					}

					if (self.ontimeupdate) self.ontimeupdate();
				}

				self.play = function() {
					if (!generatorIsReady) {
						playWasRequestedBeforeReady = true;
						return;
					}
					if (self.paused) {
						scriptNode.connect(audioCtx.destination);
						self.paused = false;
						if (self.onplay) self.onplay();

						if (hasStartedProcessing) {
							playStartTimestamp = audioCtx.currentTime;
							playFromTime = pausedAtTrackTime;
						}
					}
				};

				self.pause = function() {
					if (!self.paused) {
						pausedAtTimestamp = audioCtx.currentTime;
						pausedAtTrackTime = self.currentTime;

						scriptNode.disconnect(0);
						self.paused = true;
						if (self.onpause) self.onpause();
					}
				};


				/*
				hasStartedProcessing = false && self.paused = true  =>  initial state
				hasStartedProcessing = false && self.paused = false  =>  the instant we just called play()
				hasStartedProcessing = true && self.paused = false  =>
					ready to play if currentTime < playStartTimestamp; playing if currentTime >= playStartTimestamp
				hasStartedProcessing = true && self.paused = true  => paused
				*/

				self.__defineGetter__('currentTime', function() {
					if (!hasStartedProcessing) return playFromTime;
					if (self.paused) return pausedAtTrackTime;
					if (audioCtx.currentTime < playStartTimestamp) return playFromTime;
					return playFromTime + audioCtx.currentTime - playStartTimestamp;
				});

				self.__defineSetter__('currentTime', function(newTime) {
					seek(newTime);
				});

				return self;
			};
			this.close = function() {
				if (generator && generator.cleanup) {
					generator.cleanup();
				}
			};
		};
	};
})();
