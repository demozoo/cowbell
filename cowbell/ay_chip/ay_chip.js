/* AY-3-8912 sound chip emulation */

(function() {
	Cowbell.Common.AYChip = function(opts) {
		/* from sc68 by Benjamin Gerard / https://github.com/hatari/hatari/blob/master/src/sound.c
		/* Table of unsigned 5 bit D/A output level for 1 channel as measured on a real ST (expanded from 4 bits to 5 bits) */
		/* Vol 0 should be 310 when measuread as a voltage, but we set it to 0 in order to have a volume=0 matching */
		/* the 0 level of a 16 bits unsigned sample (no sound output) */
		var VOLUME_LEVELS_YM = [
			  0/0x2fffd /*310*/,  369/0x2fffd,  438/0x2fffd,  521/0x2fffd,  619/0x2fffd,  735/0x2fffd,  874/0x2fffd, 1039/0x2fffd,
			 1234/0x2fffd, 1467/0x2fffd, 1744/0x2fffd, 2072/0x2fffd, 2463/0x2fffd, 2927/0x2fffd, 3479/0x2fffd, 4135/0x2fffd,
			 4914/0x2fffd, 5841/0x2fffd, 6942/0x2fffd, 8250/0x2fffd, 9806/0x2fffd,11654/0x2fffd,13851/0x2fffd,16462/0x2fffd,
			19565/0x2fffd,23253/0x2fffd,27636/0x2fffd,32845/0x2fffd,39037/0x2fffd,46395/0x2fffd,55141/0x2fffd,65535/0x2fffd
		];
		/* the AY volume table has double entries to halve the envelope speed, see cyclesPerSampleEnv below */
		var VOLUME_LEVELS_AY = [
			0.000000, 0.000000, 0.004583, 0.004583, 0.006821, 0.006821, 0.009684, 0.009684,
			0.014114, 0.014114, 0.020614, 0.020614, 0.028239, 0.028239, 0.045633, 0.045633,
			0.056376, 0.056376, 0.088220, 0.088220, 0.117568, 0.117568, 0.149977, 0.149977,
			0.190123, 0.190123, 0.229088, 0.229088, 0.282717, 0.282717, 0.333324, 0.333324
		];

		var STEREO_MODES = {
			'ABC': [0.25, 0.5, 0.75],
			'ACB': [0.25, 0.75, 0.5],
			'BAC': [0.5, 0.25, 0.75],
			'BCA': [0.75, 0.25, 0.5],
			'CAB': [0.5, 0.75, 0.25],
			'CBA': [0.75, 0.5, 0.25]
		};

		var frequency = opts.frequency;
		var sampleRate = opts.sampleRate;
		var mode = opts.mode;
		var volumeLevels = VOLUME_LEVELS_AY;

		var cyclesPerSample = frequency / sampleRate;
		/* envelope runs at double speed of an AY to cater for YM envelopes - in AY mode speed is halved again via volume table */
		var cyclesPerSampleEnv = frequency / sampleRate * 2;

		var toneGeneratorAPhase = 0;
		var toneGeneratorAPeriod = 8;
		var toneGeneratorACounter = 0;

		var toneGeneratorBPhase = 0;
		var toneGeneratorBPeriod = 8;
		var toneGeneratorBCounter = 0;

		var toneGeneratorCPhase = 0;
		var toneGeneratorCPeriod = 8;
		var toneGeneratorCCounter = 0;

		var noiseGeneratorPhase = 0;
		var noiseGeneratorPeriod = 16;
		var noiseGeneratorCounter = 0;
		var noiseGeneratorSeed = 1;

		var toneChanAMask = 0x00;
		var toneChanBMask = 0x00;
		var toneChanCMask = 0x00;
		var noiseChanAMask = 0x00;
		var noiseChanBMask = 0x00;
		var noiseChanCMask = 0x00;

		var envelopePeriod = 256;
		var envelopeCounter = 0;
		var envelopeRampCounter = 31;
		var envelopeOnFirstRamp = true;
		var envelopeAlternateMask = 0x00;
		var envelopeAlternatePhase = 0x00;
		var envelopeHoldMask = 0x00;
		var envelopeAttackMask = 0x00;
		var envelopeContinueMask = 0x00;
		var envelopeValue = 0x00;

		var panning;
		if (opts.panning) {
			panning = opts.panning;
		} else if (opts.stereoMode) {
			panning = STEREO_MODES[opts.stereoMode.toUpperCase()] || [0.5, 0.5, 0.5];
		} else {
			panning = [0.5, 0.5, 0.5];
		}
		if (mode == "YM") {
			volumeLevels = VOLUME_LEVELS_YM;
		}

		var panVolumeAdjust = [];
		for (var i = 0; i < 3; i++) {
			/* kebby says we should do this. And you don't argue with kebby.
			http://conspiracy.hu/articles/8/ */
			panVolumeAdjust[i] = [
				Math.sqrt(1.0-panning[i]), Math.sqrt(panning[i])
			];
		}

		var registers = new Uint8Array(14);

		this.setRegister = function(reg, val) {
			registers[reg] = val;
			switch(reg) {
				case 0:
				case 1:
					toneGeneratorAPeriod = (((registers[1] & 0x0f) << 8) | registers[0]) * 8;
					if (toneGeneratorAPeriod === 0) toneGeneratorAPeriod = 8;
					break;
				case 2:
				case 3:
					toneGeneratorBPeriod = (((registers[3] & 0x0f) << 8) | registers[2]) * 8;
					if (toneGeneratorBPeriod === 0) toneGeneratorBPeriod = 8;
					break;
				case 4:
				case 5:
					toneGeneratorCPeriod = (((registers[5] & 0x0f) << 8) | registers[4]) * 8;
					if (toneGeneratorCPeriod === 0) toneGeneratorCPeriod = 8;
					break;
				case 6:
					noiseGeneratorPeriod = (val & 0x1f) * 16;
					if (noiseGeneratorPeriod === 0) noiseGeneratorPeriod = 16;
					break;
				case 7:
					toneChanAMask = (val & 0x01) ? 0xff : 0x00;
					toneChanBMask = (val & 0x02) ? 0xff : 0x00;
					toneChanCMask = (val & 0x04) ? 0xff : 0x00;
					noiseChanAMask = (val & 0x08) ? 0xff : 0x00;
					noiseChanBMask = (val & 0x10) ? 0xff : 0x00;
					noiseChanCMask = (val & 0x20) ? 0xff : 0x00;
					break;
				case 11:
				case 12:
					envelopePeriod = ((registers[12] << 8) | registers[11]) * 16;
					if (envelopePeriod === 0) envelopePeriod = 16;
					break;
				case 13:
					envelopeCounter = 0;
					envelopeRampCounter = 32;
					envelopeOnFirstRamp = true;
					envelopeAlternatePhase = 0x00;
					envelopeHoldMask = (val & 0x01) ? 0x01f : 0x00;
					envelopeAlternateMask = (val & 0x02) ? 0x01f : 0x00;
					envelopeAttackMask = (val & 0x04) ? 0x01f : 0x00;
					envelopeContinueMask = (val & 0x08) ? 0x01f : 0x00;
					break;
			}
		};
		this.generate = function(outputBuffer, offset, count) {
			var bufferEnd = offset + count;
			var leftChannelData = outputBuffer.getChannelData(0);
			var rightChannelData = outputBuffer.getChannelData(1);

			for (var bufferPos = offset; bufferPos < bufferEnd; bufferPos++) {

				toneGeneratorACounter -= cyclesPerSample;
				while (toneGeneratorACounter < 0) {
					toneGeneratorACounter += toneGeneratorAPeriod;
					toneGeneratorAPhase ^= 0xff;
				}

				toneGeneratorBCounter -= cyclesPerSample;
				while (toneGeneratorBCounter < 0) {
					toneGeneratorBCounter += toneGeneratorBPeriod;
					toneGeneratorBPhase ^= 0xff;
				}

				toneGeneratorCCounter -= cyclesPerSample;
				while (toneGeneratorCCounter < 0) {
					toneGeneratorCCounter += toneGeneratorCPeriod;
					toneGeneratorCPhase ^= 0xff;
				}

				noiseGeneratorCounter -= cyclesPerSample;
				while (noiseGeneratorCounter < 0) {
					noiseGeneratorCounter += noiseGeneratorPeriod;

					if ((noiseGeneratorSeed + 1) & 2)
						noiseGeneratorPhase ^= 0xff;

					/* rng is 17-bit shift reg, bit 0 is output.
					* input is bit 0 xor bit 3.
					*/
					if (noiseGeneratorSeed & 1) noiseGeneratorSeed ^= 0x24000;
					noiseGeneratorSeed >>= 1;
				}

				envelopeCounter -= cyclesPerSampleEnv;
				while (envelopeCounter < 0) {
					envelopeCounter += envelopePeriod;

					envelopeRampCounter--;
					if (envelopeRampCounter < 0) {
						envelopeRampCounter = 31;
						envelopeOnFirstRamp = false;
						envelopeAlternatePhase ^= 0x01f;
					}

					envelopeValue = (
						/* start with the descending ramp counter */
						envelopeRampCounter
						/* XOR with the 'alternating' bit if on an even-numbered ramp */
						^ (envelopeAlternatePhase && envelopeAlternateMask)
					);
					/* OR with the 'hold' bit if past the first ramp */
					if (!envelopeOnFirstRamp) envelopeValue |= envelopeHoldMask;
					/* XOR with the 'attack' bit */
					envelopeValue ^= envelopeAttackMask;
					/* AND with the 'continue' bit if past the first ramp */
					if (!envelopeOnFirstRamp) envelopeValue &= envelopeContinueMask;
				}

				var levelA = volumeLevels[
					((registers[8] & 0x10) ? envelopeValue : (registers[8] & 0x0f)<<1)
					& (toneGeneratorAPhase | toneChanAMask)
					& (noiseGeneratorPhase | noiseChanAMask)
				];
				var levelB = volumeLevels[
					((registers[9] & 0x10) ? envelopeValue : (registers[9] & 0x0f)<<1)
					& (toneGeneratorBPhase | toneChanBMask)
					& (noiseGeneratorPhase | noiseChanBMask)
				];
				var levelC = volumeLevels[
					((registers[10] & 0x10) ? envelopeValue : (registers[10] & 0x0f)<<1)
					& (toneGeneratorCPhase | toneChanCMask)
					& (noiseGeneratorPhase | noiseChanCMask) 
				];
				leftChannelData[bufferPos] = (
					panVolumeAdjust[0][0] * levelA + panVolumeAdjust[1][0] * levelB + panVolumeAdjust[2][0] * levelC
				);
				rightChannelData[bufferPos] = (
					panVolumeAdjust[0][1] * levelA + panVolumeAdjust[1][1] * levelB + panVolumeAdjust[2][1] * levelC
				);
			}
		};
	};

	Cowbell.Common.AYGenerator = function(url, audioCtx, decodeFileData) {
		var AY_FREQUENCY = 1773400;
		var AY_MODE = 'AY';
		var commandFrameDuration;
		var framesPerCommandFrame;

		var self = this;

		var registerLog;

		var ayChip;
		var framesToNextCommandFrame = 0;
		var nextCommandFrameIndex = 0;

		this.seekable = true;

		this.seek = function(position) {
			var frameNum = position * audioCtx.sampleRate;
			nextCommandFrameIndex = Math.floor(frameNum / framesPerCommandFrame);
			var newRegisters = registerLog[nextCommandFrameIndex];
			if (newRegisters) {
				for (var i = 0; i < 14; i++) {
					ayChip.setRegister(i, newRegisters[i]);
				}
			}
			framesToNextCommandFrame = framesPerCommandFrame - (frameNum % framesPerCommandFrame);
			nextCommandFrameIndex++;
		};

		this.reset = function() {
			this.seek(0);
		}

		this.generateAudio = function(outputBuffer) {
			var framesGenerated = 0;

			while (framesGenerated < outputBuffer.length) {
				var framesToEndOfBuffer = outputBuffer.length - framesGenerated;
				if (framesToEndOfBuffer < framesPerCommandFrame) {
					/* generate enough frames to reach the end of the buffer */
					ayChip.generate(outputBuffer, framesGenerated, framesToEndOfBuffer);
					framesGenerated += framesToEndOfBuffer;
					framesToNextCommandFrame -= framesToEndOfBuffer;
					break;
				} else {
					/* generate all the frames that get us to the next command */
					var framesToGenerate = Math.floor(framesToNextCommandFrame);
					ayChip.generate(outputBuffer, framesGenerated, framesToGenerate);
					framesGenerated += framesToGenerate;
					framesToNextCommandFrame -= framesToGenerate;
				}

				/* read next command frame */
				if (nextCommandFrameIndex >= registerLog.length) {
					return framesGenerated;
				}
				var newRegisters = registerLog[nextCommandFrameIndex];
				for (var i = 0; i < 13; i++) {
					ayChip.setRegister(i, newRegisters[i]);
				}
				if (newRegisters[14]) ayChip.setRegister(13, newRegisters[13]);
				nextCommandFrameIndex++;
				framesToNextCommandFrame += framesPerCommandFrame;
			}

			return framesGenerated;
		};

		this.load = function(onReady) {
			this.channelCount = 2;

			var request = new XMLHttpRequest();

			request.addEventListener('error', function(e) {
				console.log('XHR error', e);
			});

			request.addEventListener('load', function(e) {
				data = request.response;
				var dataArray = new Uint8Array(data);
				decodeFileData(dataArray, function(decodedData) {
					registerLog = decodedData['ayRegisterLog'];

					ayChip = new Cowbell.Common.AYChip({
						'frequency': decodedData['ayFrequency'] || AY_FREQUENCY,
						'panning': decodedData['panning'],
						'stereoMode': decodedData['stereoMode'],
						'sampleRate': audioCtx.sampleRate,
						'mode': decodedData['ayMode'] || AY_MODE
					});

					commandFrameDuration = 1 / (decodedData['commandFrequency'] || 50);
					framesPerCommandFrame = commandFrameDuration * audioCtx.sampleRate;

					self.duration = registerLog.length * commandFrameDuration;

					onReady();
				});
			});

			/* trigger XHR */
			request.open('GET', url, true);
			request.responseType = "arraybuffer";
			request.send();
		};
	};
})();
