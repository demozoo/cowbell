/* Player for the ZX Spectrum .SQT tracker format,
running the original Z80 player routine under emulation */

(function() {
	function SQTGenerator(url, audioCtx, playerOpts, trackOpts) {
		if (!playerOpts) playerOpts = {};
		if (!trackOpts) trackOpts = {};

		function Memory() {
			this.read = function(addr) {
				return _mem[addr];
			};
			this.write = function(addr, val) {
				_mem[addr] = val;
			};
		}

		return new Cowbell.Common.AYGenerator(url, audioCtx, function(sqt, onReady) {
			var index = 0x10;

			var ayRegisters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false];
			var ayRegisterLog = [];
			var selectedAYRegister = 0;
			var frameCount;

			var Z80Processor = Cowbell.Common.buildZ80({});

			var _mem = new Uint8Array(0x10000);

			/* load SQT player at address 0x4000 */
			for (var i = 0; i < Cowbell.Common.SQTPlayerBin.length; i++) {
				_mem[0x4000 + i] = Cowbell.Common.SQTPlayerBin[i];
			}
			/* load SQT data at address 0x5000 */
			for (i = 0; i < sqt.length; i++) {
				_mem[0x5000 + i] = sqt[i];
			}
			/* the SQT format contains a block of absolute addresses (grr), so we need to find out
			the original base address of the module and fix up those addresses accordingly */
			var originalBaseAddress = (_mem[0x5002] | (_mem[0x5003] << 8)) - 10;
			var offset = 0x5000 - originalBaseAddress; /* add this to each address that needs fixing up */
			/* get the address of the first byte after the block of addresses that need relocating */
			var relocateEnd = (_mem[0x500c] | (_mem[0x500d] << 8)) + offset;

			for (i = 0x5002; i < relocateEnd; i += 2) {
				var correctedAddress = (_mem[i] | (_mem[i + 1] << 8)) + offset;
				_mem[i] = correctedAddress & 0xff;
				_mem[i + 1] = correctedAddress >> 8;
			}

			var z80 = Z80Processor({
				memory: {
					'read': function(addr) {return _mem[addr];},
					'write': function(addr, val) {_mem[addr] = val;}
				},
				ioBus: {
					'write': function(addr, val) {
						if ((addr & 0xc002) == 0xc000) {
							/* AY register select */
							selectedAYRegister = val;
						} else if ((addr & 0xc002) == 0x8000) {
							/* AY register write */
							ayRegisters[selectedAYRegister] = val;
							if (selectedAYRegister == 13) ayRegisters[14] = true;
						}
					}
				}
			});
			/* init player */
			var count = z80.runRoutine(0x4000, 0x3f00);
			_mem[0xffff] = 0x00;

			for (var frame = 0; frame < 30000 /* 1000000 */; frame++) {
				ayRegisters[14] = false;
				count = z80.runRoutine(0x4030, 0x3f00);
				if (_mem[0xffff] == 0xfe) break;  /* loop indicator */
				ayRegisterLog.push(ayRegisters.slice());
			}

			onReady({
				'ayRegisterLog': ayRegisterLog,
				'ayFrequency': trackOpts.ayFrequency || playerOpts.ayFrequency,
				'commandFrequency': trackOpts.commandFrequency || playerOpts.commandFrequency,
				'stereoMode': trackOpts.stereoMode || playerOpts.stereoMode,
				'panning': trackOpts.panning || playerOpts.panning,
				'ayMode': trackOpts.ayMode || playerOpts.ayMode
			});
		});
	}


	Cowbell.Player.ZXSQT = function(opts) {
		return new Cowbell.Common.WebAudioPlayer(SQTGenerator, opts);
	};
})();
