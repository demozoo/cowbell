/*
Wrapper to allow Web Audio createScriptProcessor-based player routines to expose
a subset of the HTML5 Media Element API.

This wrapper handles the details of buffering, pausing, and keeping track of current play time.
Inner routines only need to implement a simple 'generator' API consisting of filling a buffer
with audio data, and seeking to a specified time.
*/

Cowbell.Common.WebAudioPlayer = function(url, generatorConstructor) {
	var BUFFER_SIZE = 4096;

	var audioCtx = new AudioContext();

	this.HAVE_NOTHING = 0;
	this.HAVE_METADATA = 1;
	this.HAVE_CURRENT_DATA = 2;
	this.HAVE_FUTURE_DATA = 3;
	this.HAVE_ENOUGH_DATA = 4;
	this.readyState = this.HAVE_NOTHING;

	var generator = new generatorConstructor(url, audioCtx);
	var generatorIsReady = false;
	var playWasRequestedBeforeReady = false;
	var scriptNode;
	var self = this;

	var hasStartedProcessing = false;
	var playFromTime = 0;
	var playStartTimestamp;
	this.paused = true;

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

	this.play = function() {
		if (!generatorIsReady) {
			playWasRequestedBeforeReady = true;
			return;
		}
		if (this.paused) {
			scriptNode.connect(audioCtx.destination);
			this.paused = false;
			if (this.onplay) this.onplay();

			if (hasStartedProcessing) {
				playStartTimestamp = audioCtx.currentTime;
				playFromTime = pausedAtTrackTime;
			}
		}
	};

	this.pause = function() {
		if (!this.paused) {
			pausedAtTimestamp = audioCtx.currentTime;
			pausedAtTrackTime = this.currentTime;

			scriptNode.disconnect(0);
			this.paused = true;
			if (this.onpause) this.onpause();
		}
	};


	/*
	hasStartedProcessing = false && this.paused = true  =>  initial state
	hasStartedProcessing = false && this.paused = false  =>  the instant we just called play()
	hasStartedProcessing = true && this.paused = false  =>
		ready to play if currentTime < playStartTimestamp; playing if currentTime >= playStartTimestamp
	hasStartedProcessing = true && this.paused = true  => paused
	*/

	this.__defineGetter__('currentTime', function() {
		if (!hasStartedProcessing) return playFromTime;
		if (self.paused) return pausedTrackTime;
		if (audioCtx.currentTime < playStartTimestamp) return playFromTime;
		return playFromTime + audioCtx.currentTime - playStartTimestamp;
	});

	this.__defineSetter__('currentTime', function(newTime) {
		seek(newTime);
	});
};
