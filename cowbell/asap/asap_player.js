(function() {
	function ASAPGenerator(url, audioCtx, playerOpts, trackOpts) {
		this.asap = new ASAP();
		this.rateCoefficient = 1;
		if (audioCtx.sampleRate != ASAP.SAMPLE_RATE) {
			this.rateCoefficient = ( ASAP.SAMPLE_RATE / audioCtx.sampleRate );
			if ( !ASAP.nowarn && console && console.log ) {
				console.log("Warning: sample rate mismatch (needed " + ASAP.SAMPLE_RATE + ", got " + audioCtx.sampleRate + ")");
			}
		}
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
			data = request.response;
			var dataArray = new Uint8Array(data);

			var filename = self.url.split('/').pop();
			self.asap.load(filename, dataArray, dataArray.length);
			var info = self.asap.getInfo();
			self.channelCount = info.getChannels();
			self.song = info.getDefaultSong();
			self.reportedDuration = info.getDuration(self.song);
			if (self.reportedDuration == -1) {
				self.duration = 60;
				if ( !ASAP.nowarn && console && console.log ) {
					console.log("Warning: no duration information found, defaulting to 60 seconds.");
				}
			} else {
				self.duration = self.reportedDuration / 1000;

				if ( self.rateCoefficient ) {
					if ( !ASAP.nolog && console && console.log ) {
						if ( self.rateCoefficient !== 1 ) {
						  console.log( 'rate coefficient: ' + self.rateCoefficient );
            }
					}
					self.duration = self.rateCoefficient * self.duration;
				}
			}

			self.seekable = true;
			self.seek = function(position) {
				// convert to milliseconds
				var milliseconds = position * 1000;

				// compensate for possible sample rate mixups
				self.asap.seek( milliseconds * self.rateCoefficient );
			};

			onReady();
		});

		/* trigger XHR */
		request.open('GET', self.url, true);
		request.responseType = "arraybuffer";
		request.send();
	};
	ASAPGenerator.prototype.reset = function() {
		this.asap.playSong(this.song, this.reportedDuration);
		this.seek(0)
	};
	ASAPGenerator.prototype.generateAudio = function (outputBuffer) {
		var requiredBufferLength = outputBuffer.length * this.channelCount;
		if (this.buffer.length < requiredBufferLength) {
			this.buffer = new Uint8Array(requiredBufferLength);
		}
		var generatedLength = this.asap.generate(this.buffer, requiredBufferLength, ASAPSampleFormat.U8);

		if ( generatedLength === ASAP.WAITING_ON_SEEK ) return ASAP.WAITING_ON_SEEK;

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
