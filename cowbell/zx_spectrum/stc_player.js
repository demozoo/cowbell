/* Player for the ZX Spectrum .STC tracker format */

(function() {
	function STCGenerator(url, audioCtx, playerOpts, trackOpts) {
		if (!playerOpts) playerOpts = {};
		if (!trackOpts) trackOpts = {};


		var endianTestBuffer = new ArrayBuffer(2);
		var endianTestUint16 = new Uint16Array(endianTestBuffer);
		var endianTestUint8 = new Uint8Array(endianTestBuffer);
		endianTestUint16[0] = 0x0100;
		var isBigEndian = (endianTestUint8[0] == 0x01);

		var registerBuffer = new ArrayBuffer(26);
		/* Expose registerBuffer as both register pairs and individual registers */
		var rp = new Uint16Array(registerBuffer);
		var r = new Uint8Array(registerBuffer);

		var BC = 1, DE = 2, HL = 3, IX = 4, IY = 5;

		var A, B, C, D, E, H, L, IXH, IXL, IYH, IYL;
		if (isBigEndian) {
			A = 0;
			B = 2; C = 3;
			D = 4; E = 5;
			H = 6; L = 7;
			IXH = 8; IXL = 9;
			IYH = 10; IYL = 11;
		} else {
			A = 1;
			B = 3; C = 2;
			D = 5; E = 4;
			H = 7; L = 6;
			IXH = 9; IXL = 8;
			IYH = 11; IYL = 10;
		}

		var mem;

		var ayRegisters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false];
		var selectedAYRegister = 0;
		function out(port, val) {
			if ((port & 0xc002) == 0xc000) {
				/* AY register select */
				selectedAYRegister = val;
			} else if ((port & 0xc002) == 0x8000) {
				/* AY register write */
				ayRegisters[selectedAYRegister] = val;
				if (selectedAYRegister == 13) ayRegisters[14] = true;
			}
		}

		var dataAddr;
		var positionsTable, ornamentsTable, patternsTable, samplesTable;
		var songLength, nextPositionNum, height;
		var tempo, tempoCounter;

		var patternPtrs = new Uint16Array(3);
		var ayRegBuffer = new Uint16Array(0x0e);

		var chanNotes = new Uint8Array(3);
		var chanEnvelopeStates = new Uint8Array(3);  /* 0 = off, 1 = triggered, 2 = running */
		var chanSamplePtrs = new Uint16Array(3);
		var chanSampleIndexes = new Uint8Array(3);
		var chanSampleCounters = new Uint8Array(3);
		var chanPatternStepCounter = new Uint8Array(3);
		var chanPatternStep = new Uint8Array(3);
		var chanOrnamentPtrs = new Uint16Array(3);

		var songHasLooped;

		function stcInit() {
			/*
			Inputs: []
			Outputs: []
			Overwrites: ['D', 'zFlag', 'cFlag', 'sFlag', 'H', 'L', 'A', 'E', 'pvFlag', 'B', 'C']
			*/

			songHasLooped = false;

			rp[HL] = dataAddr = 0x0001;
			/* DI */
			tempo = mem[dataAddr];
			rp[HL]++;
			rp[DE] = readPointer();
			songLength = mem[rp[DE]] + 1;
			positionsTable = rp[DE] + 1;
			ornamentsTable = readPointer();
			patternsTable = readPointer();
			samplesTable = dataAddr + 0x001b;

			patternPtrs[0] = 0x0000;  // point to dummy 'fetch new pattern' pattern data
			var nullOrnamentPtr = scan(ornamentsTable, 0x0021, 0x00) + 1;
			for (i = 0; i < 3; i++) {
				chanNotes[i] = 0;
				chanSamplePtrs[i] = 0;
				chanSampleIndexes[i] = 0;
				chanOrnamentPtrs[i] = nullOrnamentPtr;
				chanSampleCounters[i] = 0xff;
			}
			nextPositionNum = 0;

			tempoCounter = 0x01;
			writeAY();
			/* EI */
			return;
		}

		function stcPlay() {
			/*
			Inputs: ['cFlag']
			Outputs: []
			Overwrites: ['zFlag', 'cFlag', 'sFlag', 'H', 'IXL', 'L', 'A', 'pvFlag', 'B', 'C', 'IXH']
			*/
			var chan;
			var sampleIndex;

			tempoCounter--;
			if (tempoCounter === 0x00) {
				tempoCounter = tempo;
				chan = 0;
				if (advancePatternStep(chan)) {
					if (mem[patternPtrs[0]] == 0xff) newPosition();
					patternPtrs[0] = fetchPatternData(chan, patternPtrs[0]);
				}
				chan = 1;
				if (advancePatternStep(chan)) {
					patternPtrs[1] = fetchPatternData(chan, patternPtrs[1]);
				}
				chan = 2;
				if (advancePatternStep(chan)) {
					patternPtrs[2] = fetchPatternData(chan, patternPtrs[2]);
				}
			}
			chan = 0;
			r[C] = advanceSample(chan);
			sampleIndex = r[C];
			getSampleData(chanSamplePtrs[chan], sampleIndex);
			ayRegBuffer[0x07] = (r[C] | r[B]) >> 1;

			if (chanSampleCounters[chan] == 0xff) {
				ayRegBuffer[0x08] = 0x00;
			} else {
				if (!r[C]) ayRegBuffer[0x06] = r[H]; // set noise reg if noise mask is off
				r[A] = r[L];
				rp[HL] = getTone(chan, rp[DE], sampleIndex);
				ayRegBuffer[0x00] = r[L]; ayRegBuffer[0x01] = r[H];
				ayRegBuffer[0x08] = r[A];
				applyEnvelope(chan, 0x08);
			}

			chan = 1;
			r[C] = advanceSample(chan);

			if (chanSampleCounters[chan] == 0xff) {
				ayRegBuffer[0x09] = 0x00;
			} else {
				sampleIndex = r[C];
				getSampleData(chanSamplePtrs[chan], sampleIndex);
				ayRegBuffer[0x07] |= r[C] | r[B];
				if (!r[C]) ayRegBuffer[0x06] = r[H]; // set noise reg if noise mask is off
				r[A] = r[L];
				rp[HL] = getTone(chan, rp[DE], sampleIndex);
				ayRegBuffer[0x02] = r[L]; ayRegBuffer[0x03] = r[H];
				ayRegBuffer[0x09] = r[A];
				applyEnvelope(chan, 0x09);
			}

			chan = 2;
			r[C] = advanceSample(chan);

			if (chanSampleCounters[chan] == 0xff) {
				ayRegBuffer[0x0a] = 0x00;
			} else {
				sampleIndex = r[C];
				getSampleData(chanSamplePtrs[chan], sampleIndex);
				r[C] = (r[C] << 1);
				r[B] = (r[B] << 1);
				ayRegBuffer[0x07] |= r[C] | r[B];
				if (!r[C]) ayRegBuffer[0x06] = r[H]; // set noise reg if noise mask is off
				r[A] = r[L];
				rp[HL] = getTone(chan, rp[DE], sampleIndex);
				ayRegBuffer[0x04] = r[L]; ayRegBuffer[0x05] = r[H];
				ayRegBuffer[0x0a] = r[A];
				applyEnvelope(chan, 0x0a);
			}

			writeAY();
		}

		function readPointer() {
			/*
			Read a pointer from address HL, advance HL,
			and return the pointer converted to an address

			Inputs: ['H', 'L']
			Outputs: ['D', 'E', 'H', 'C', 'L']
			Overwrites: ['D', 'cFlag', 'H', 'L', 'E', 'B', 'C']
			*/
			r[E] = mem[rp[HL]];
			rp[HL]++;
			r[D] = mem[rp[HL]];
			rp[HL]++;

			return rp[DE] + dataAddr;
		}

		function scan(addr, len, id) {
			/*
			Scan through a table of records, starting from 'addr' and each 'len' bytes long,
			for one beginning with byte 'id'. Return its address.

			Inputs: ['A', 'B', 'H', 'C', 'L']
			Outputs: ['H', 'L']
			Overwrites: ['pvFlag', 'cFlag', 'zFlag', 'sFlag', 'H', 'L']
			*/
			while (mem[addr] != id) {
				addr += len;
			}
			return addr;
		}

		function writeAY() {
			/*
			Inputs: ['A']
			Outputs: []
			Overwrites: ['cFlag', 'zFlag', 'sFlag', 'H', 'L', 'A', 'pvFlag', 'B', 'C']
			*/
			var reg = 0x0d;
			if (ayRegBuffer[reg] === 0) {
				reg -= 0x03;
			}
			do {
				out(0xfffd, reg);
				out(0xbffd, ayRegBuffer[reg]);
				reg--;
			} while (reg >= 0);
			rp[BC] = 0xbffd;  // WHY?!?
		}

		function advancePatternStep(chan) {
			/*
			Inputs: ['IXL', 'IXH']
			Outputs: ['sFlag']
			Overwrites: ['sFlag', 'A', 'zFlag', 'pvFlag']
			*/
			chanPatternStepCounter[chan]--;
			if (chanPatternStepCounter[chan] & 0x80) {
				/* mystery counter looped */
				chanPatternStepCounter[chan] = chanPatternStep[chan];
				return true;
			} else {
				return false;
			}
		}

		function newPosition() {
			/*
			Inputs: []
			Outputs: ['C']
			Overwrites: ['D', 'cFlag', 'zFlag', 'sFlag', 'H', 'L', 'A', 'pvFlag', 'E', 'B', 'C']
			*/
			var positionNum = nextPositionNum;
			if (nextPositionNum >= songLength) {
				songHasLooped = true;
				nextPositionNum = 0x00;
				positionNum = 0x00;
			}
			nextPositionNum++;
			var positionPtr = (positionNum << 1) + positionsTable;
			var patternId = mem[positionPtr];
			r[C] = patternId; // apparently needed...
			height = mem[positionPtr + 1];
			rp[HL] = scan(patternsTable, 0x0007, patternId) + 1;
			patternPtrs[0] = readPointer();
			patternPtrs[1] = readPointer();
			patternPtrs[2] = readPointer();
		}

		function fetchPatternData(chan, patternPtr) {
			/*
			Inputs: ['IXL', 'IXH', 'H', 'L']
			Outputs: ['H', 'C', 'cFlag', 'L']
			Overwrites: ['zFlag', 'cFlag', 'sFlag', 'H', 'L', 'A', 'pvFlag', 'B', 'C']
			*/
			var pushedHL;
			while (true) {
				var command = mem[patternPtr];
				if (command < 0x60) {
					/* note */
					chanNotes[chan] = command;
					chanSampleIndexes[chan] = 0x00;
					chanSampleCounters[chan] = 0x20;
					patternPtr++;
					return patternPtr;
				} else if (command < 0x70) {
					/* sample */
					rp[BC] = 0x0063; /* seemingly needed... */
					chanSamplePtrs[chan] = scan(samplesTable, 0x0063, command - 0x60) + 1;
					patternPtr++;
				} else if (command < 0x80) {
					/* ornament */
					chanOrnamentPtrs[chan] = scan(ornamentsTable, 0x0021, command - 0x70) + 1;
					chanEnvelopeStates[chan] = 0x00;
					patternPtr++;
				} else if (command == 0x80) {
					/* rest */
					patternPtr++;
					chanSampleCounters[chan] = 0xff;
					return patternPtr;
				} else if (command == 0x81) {
					/* empty */
					patternPtr++;
					return patternPtr;
				} else if (command == 0x82) {
					/* ornament off */
					chanOrnamentPtrs[chan] = scan(ornamentsTable, 0x0021, 0x00) + 1;
					chanEnvelopeStates[chan] = 0x00;
					patternPtr++;
				} else if (command < 0x8f) {
					/* envelope */
					ayRegBuffer[0x0d] = command - 0x80;
					patternPtr++;
					ayRegBuffer[0x0b] = mem[patternPtr];
					patternPtr++;
					chanEnvelopeStates[chan] = 0x01;
					chanOrnamentPtrs[chan] = scan(ornamentsTable, 0x0021, 0x00) + 1;
				} else {
					command = (command - 0xa1) & 0xff;
					chanPatternStepCounter[chan] = command;
					chanPatternStep[chan] = command;
					patternPtr++;
				}
			}
		}

		function advanceSample(chan) {
			/*
			Inputs: ['IXL', 'cFlag', 'IXH']
			Outputs: ['H', 'C', 'cFlag', 'L']
			Overwrites: ['D', 'zFlag', 'cFlag', 'sFlag', 'H', 'L', 'A', 'pvFlag', 'E', 'C']
			*/
			var samplesLeft, currentSampleIndex, repeatIndex;

			if (chanSampleCounters[chan] == 0xff) return r[C];
			samplesLeft = (chanSampleCounters[chan] - 1) & 0xff;
			chanSampleCounters[chan] = samplesLeft;

			currentSampleIndex = chanSampleIndexes[chan];
			chanSampleIndexes[chan] = (currentSampleIndex + 1) & 0x1f;
			if (samplesLeft) return currentSampleIndex;

			var sampleMetaAddr = chanSamplePtrs[chan] + 0x0060;
			repeatIndex = (mem[sampleMetaAddr] - 1) & 0xff;
			if (repeatIndex & 0x80) {
				/* no repeat */
				chanSampleCounters[chan] = 0xff;
				return currentSampleIndex;
			} else {
				chanSampleIndexes[chan] = (repeatIndex + 1) & 0x1f;
				chanSampleCounters[chan] = mem[sampleMetaAddr + 1] + 1;
				return repeatIndex;
			}
		}

		function getSampleData(samplePtr, index) {
			/*
			Inputs: ['A', 'IXL', 'IXH']
			Outputs: ['D', 'H', 'IXL', 'L', 'E', 'B', 'C', 'IXH']
			Overwrites: ['D', 'cFlag', 'zFlag', 'sFlag', 'IXL', 'H', 'L', 'E', 'A', 'pvFlag', 'B', 'C', 'IXH']
			*/
			var a;

			samplePtr += (index * 3) & 0xff;

			a = mem[samplePtr + 0x01];
			r[C] = (a & 0x80) ? 0x10 : 0x00;
			r[B] = (a & 0x40) ? 0x02 : 0x00;
			r[H] = a & 0x1f;
			r[E] = mem[samplePtr + 0x02];

			a = mem[samplePtr + 0x00];
			r[D] = a >> 4;
			r[L] = a & 0x0f;
			if (mem[samplePtr + 0x01] & 0x20) {
				r[D] |= 0x10;
			}
		}

		var toneTable = new Uint16Array([
			0x0ef8, 0x0e10, 0x0d60, 0x0c80, 0x0bd8, 0x0b28, 0x0a88, 0x09f0,
			0x0960, 0x08e0, 0x0858, 0x07e0, 0x077c, 0x0708, 0x06b0, 0x0640,
			0x05ec, 0x0594, 0x0544, 0x04f8, 0x04b0, 0x0470, 0x042c, 0x03f0,
			0x03be, 0x0384, 0x0358, 0x0320, 0x02f6, 0x02ca, 0x02a2, 0x027c,
			0x0258, 0x0238, 0x0216, 0x01f8, 0x01df, 0x01c2, 0x01ac, 0x0190,
			0x017b, 0x0165, 0x0151, 0x013e, 0x012c, 0x011c, 0x010b, 0x00fc,
			0x00ef, 0x00e1, 0x00d6, 0x00c8, 0x00bd, 0x00b2, 0x00a8, 0x009f,
			0x0096, 0x008e, 0x0085, 0x007e, 0x0077, 0x0070, 0x006b, 0x0064,
			0x005e, 0x0059, 0x0054, 0x004f, 0x004b, 0x0047, 0x0042, 0x003f,
			0x003b, 0x0038, 0x0035, 0x0032, 0x002f, 0x002c, 0x002a, 0x0027,
			0x0025, 0x0023, 0x0021, 0x001f, 0x001d, 0x001c, 0x001a, 0x0019,
			0x0017, 0x0016, 0x0015, 0x0013, 0x0012, 0x0011, 0x0010, 0x000f
		]);

		function getTone(chan, samplePitch, sampleIndex) {
			/*
			Inputs: ['D', 'cFlag', 'zFlag', 'sFlag', 'IXL', 'L', 'E', 'pvFlag', 'IXH']
			Outputs: ['A', 'H', 'cFlag', 'L']
			Overwrites: ['D', 'cFlag', 'zFlag', 'sFlag', 'H', 'L', 'A', 'E', 'pvFlag']
			*/
			var ornPtr = chanOrnamentPtrs[chan] + sampleIndex;
			var note = (chanNotes[chan] + mem[ornPtr] + height) & 0x7f;

			var tone = toneTable[note];

			if (samplePitch & 0x1000) {
				return tone + (samplePitch & 0x0fff);
			} else {
				return tone - samplePitch;
			}
		}

		function applyEnvelope(chan, volReg) {
			/*
			Inputs: ['IXL', 'IXH', 'H', 'L']
			Outputs: ['A', 'cFlag']
			Overwrites: ['zFlag', 'cFlag', 'sFlag', 'A', 'pvFlag']
			*/
			var v = chanEnvelopeStates[chan];
			if (v === 0) {
				return;
			} else if (v == 0x02) {
				ayRegBuffer[0x0d] = 0x00;
			} else {
				chanEnvelopeStates[chan] = 0x02;
			}
			ayRegBuffer[volReg] |= 0x10;
		}


		return new Cowbell.Common.AYGenerator(url, audioCtx, function(stc, onReady) {
			var ayRegisterLog = [];
			var frameCount;

			mem = new Uint8Array(stc.length + 1);
			mem[0x0000] = 0xff;  // dummy pattern data to immediately trigger 'fetch new pattern'
			/* load STC data at address 0x0001 */
			for (i = 0; i < stc.length; i++) {
				mem[0x0001 + i] = stc[i];
			}

			stcInit();
			while (true) {
				ayRegisters[14] = false;
				stcPlay();
				if (songHasLooped) break;
				ayRegisterLog.push(ayRegisters.slice());
			}

			onReady({
				'ayRegisterLog': ayRegisterLog,
				'ayFrequency': trackOpts.ayFrequency || playerOpts.ayFrequency,
				'commandFrequency': trackOpts.commandFrequency || playerOpts.commandFrequency,
				'stereoMode': trackOpts.stereoMode || playerOpts.stereoMode,
				'panning': trackOpts.panning || playerOpts.panning
			});
		});
	}


	Cowbell.Player.ZXSTC = function(opts) {
		return new Cowbell.Common.WebAudioPlayer(STCGenerator, opts);
	};
})();
