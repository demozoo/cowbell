/* Player for the ZX Spectrum .PT3 tracker format,
running the original Z80 player routine under emulation */

(function() {
	function PT3Generator(url, audioCtx, playerOpts, trackOpts) {
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

		return new Cowbell.Common.AYGenerator(url, audioCtx, function(pt3, onReady) {
			var index = 0x10;

			var ayRegisters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false];
			var ayRegisterLog = [];
			var selectedAYRegister = 0;
			var frameCount;

			var Z80Processor = Cowbell.Common.buildZ80({});

			var _mem = new Uint8Array(0x10000);

			/* load PT3 player at address 0x4000 */
			for (var i = 0; i < Cowbell.Common.PT3PlayerBin.length; i++) {
				_mem[0x4000 + i] = Cowbell.Common.PT3PlayerBin[i];
			}
			/* load PT3 data at address 0x486e */
			for (i = 0; i < pt3.length; i++) {
				_mem[0x486e + i] = pt3[i];
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

			for (var frame = 0; frame < 1000000; frame++) {
				ayRegisters[14] = false;
				count = z80.runRoutine(0x4005, 0x3f00);
				if (_mem[0x400a] !== 0) break;  /* 0x400a = loop indicator */
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


	Cowbell.Player.ZXPT3 = function(opts) {
		return new Cowbell.Common.WebAudioPlayer(PT3Generator, opts);
	};
})();
