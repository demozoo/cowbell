/* Player for the ZX Spectrum .STC tracker format,
running the original Z80 player routine under emulation */

(function() {
	function STCGenerator(url, audioCtx, playerOpts, trackOpts) {
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

		return new Cowbell.Common.AYGenerator(url, audioCtx, function(stc, onReady) {
			var index = 0x10;

			var ayRegisters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false];
			var ayRegisterLog = [];
			var selectedAYRegister = 0;
			var frameCount;

			var hasLooped = false;
			window.stcOnLoop = function() {
				hasLooped = true;
			};
			var Z80Processor = Cowbell.Common.buildZ80({
				'traps': [
					[0x4103, 0xaf, 'stcOnLoop()']
				]
			});

			var _mem = new Uint8Array(0x10000);

			/* load STC player at address 0x4000 */
			for (var i = 0; i < Cowbell.Common.STCPlayerBin.length; i++) {
				_mem[0x4000 + i] = Cowbell.Common.STCPlayerBin[i];
			}
			/* load STC data at address 0x443c */
			for (i = 0; i < stc.length; i++) {
				_mem[0x443c + i] = stc[i];
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
				count = z80.runRoutine(0x4006, 0x3f00);
				if (hasLooped) break;
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
