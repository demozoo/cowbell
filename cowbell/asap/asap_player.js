(function() {
	function ASAPGenerator(url, audioCtx, playerOpts, trackOpts) {
		this.asap = new ASAP();
		this.asap.setSampleRate(audioCtx.sampleRate);
		this.url = url;
		this.buffer = new Uint8Array(65536);
	}
	ASAPGenerator.prototype.load = function(onReady) {
		var self = this;

		var request = new XMLHttpRequest();

		request.addEventListener('error', function(e) {
			console.log('XHR error', e);
		});

		request.addEventListener('load', function(e) {
			const data = request.response;
			var dataArray = new Uint8Array(data);

			var filename = self.url.split('/').pop();
			let songNumber = null;

			// extract anchor part if present
			let match = filename.match(/^(.*?)(\#.*)$/);
			if (match) {
				filename = match[1];
				songNumber = parseInt(match[2].substr(1));
				if (isNaN(songNumber)) {
					songNumber = null;
				}
			}

			self.asap.load(filename, dataArray, dataArray.length);
			var info = self.asap.getInfo();
			self.channelCount = info.getChannels();
			if (songNumber !== null) {
				self.song = songNumber - 1; // user-facing song numbers are 1-indexed
			} else {
				self.song = info.getDefaultSong();
			}
			self.reportedDuration = info.getDuration(self.song);
			if (self.reportedDuration == -1) {
				self.duration = 60;
			} else {
				self.duration = self.reportedDuration / 1000;
			}
			self.seekable = false;

			onReady();
		});

		/* trigger XHR */
		request.open('GET', self.url, true);
		request.responseType = "arraybuffer";
		request.send();
	};
	ASAPGenerator.prototype.reset = function() {
		this.asap.playSong(this.song, this.reportedDuration);
	};
	ASAPGenerator.prototype.generateAudio = function (outputBuffer) {
		var requiredBufferLength = outputBuffer.length * this.channelCount;
		if (this.buffer.length < requiredBufferLength) {
			this.buffer = new Uint8Array(requiredBufferLength);
		}
		var generatedLength = this.asap.generate(this.buffer, requiredBufferLength, ASAPSampleFormat.U8);
		var sampleIndex;
		for (var c = 0; c < this.channelCount; c++) {
			var channelBuffer = outputBuffer.getChannelData(c);
			sampleIndex = 0;
			for (var i = c; i < generatedLength; i += this.channelCount) {
				channelBuffer[sampleIndex] = (this.buffer[i] - 128) / 128;
				sampleIndex++;
			}
		}
		return sampleIndex;
	};

	Cowbell.Player.ASAP = function(opts) {
		return new Cowbell.Common.WebAudioPlayer(ASAPGenerator, opts);
	};
})();
