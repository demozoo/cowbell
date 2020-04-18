/* Player for the .PSG format (an uncompressed stream of AY chip commands) */

(function() {
	function PSGGenerator(url, audioCtx, playerOpts, trackOpts) {
		if (!playerOpts) playerOpts = {};
		if (!trackOpts) trackOpts = {};
 		return new Cowbell.Common.AYGenerator(url, audioCtx, function(psg, onReady) {
			var signature = String.fromCharCode.apply(null, psg.subarray(0,4));
			if (signature !== "PSG\x1a") {
				throw "Not a PSG file";
			}
			var index = 0x10;

			var registers = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false];
			var registerLog = [];
			var frameCount;

			while (index < psg.length) {
				/* scan for the next 0xf? command */
				registers[14] = false;
				while (true) {
					var command = psg[index];
					index++;
					if (command == 0xfd) {
						index=psg.length;
						break;
					} else if (command == 0xff) {
						frameCount = 1;
						break;
					} else if (command == 0xfe) {
						frameCount = psg[index] * 4;
						index++;
						break;
					} else if (command < 14) {
						registers[command] = psg[index];
						index++;
						if (command == 13) {
							/* mark reg13 as written */
							registers[14] = true;
						}
					} else {
						throw "Unexpected command: " + command;
					}
				}
				for (var i = 0; i < frameCount; i++) {
					registerLog.push(registers.slice());
				}
			}

			onReady({
				'ayRegisterLog': registerLog,
				'ayFrequency': trackOpts.ayFrequency || playerOpts.ayFrequency,
				'ayEnvDepth': trackOpts.ayEnvDepth || playerOpts.ayEnvDepth
			});
		});
	}

	Cowbell.Player.PSG = function(opts) {
		return new Cowbell.Common.WebAudioPlayer(PSGGenerator,opts);
	};
})();
