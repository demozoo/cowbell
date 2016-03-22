/* Player for the .VTX format (an LH5-compressed stream of AY chip events) */

(function() {
	function VTXGenerator(url, audioCtx) {
		return new Cowbell.Common.AYGenerator(url, audioCtx, function(vtx, onReady) {
			var signature = String.fromCharCode.apply(null, vtx.subarray(0,2));
			if (signature !== "ay" && signature !== "ym") {
				throw "Not a VTX file";
			}

			var STEREO_MODES = {
				1: [0.25, 0.5, 0.75], // ABC
				2: [0.25, 0.75, 0.5], // ACB
				3: [0.5, 0.25, 0.75], // BAC
				4: [0.75, 0.25, 0.5], // BCA
				5: [0.5, 0.75, 0.25], // CAB
				6: [0.75, 0.5, 0.25]  // CBA
			};
			var stereoMode = vtx[2] & 0x07;
			var panning = STEREO_MODES[stereoMode] || [0.5, 0.5, 0.5];  // mono

			var ayFrequency = (vtx[8] << 24) | (vtx[7] << 16) | (vtx[6] << 8) | vtx[5];
			var commandFrequency = vtx[9];

			var createdYear = (vtx[11] << 8) | vtx[10];
			var unpackedSize = (vtx[15] << 24) | (vtx[14] << 16) | (vtx[13] << 8) | vtx[12];

			var currentOffset = 16;

			var titleOffset = 16;
			while (vtx[currentOffset] !== 0) currentOffset++;
			var title = String.fromCharCode.apply(null, vtx.subarray(titleOffset, currentOffset));
			currentOffset++;

			var authorOffset = currentOffset;
			while (vtx[currentOffset] !== 0) currentOffset++;
			var author = String.fromCharCode.apply(null, vtx.subarray(authorOffset, currentOffset));
			currentOffset++;

			var sourceProgramOffset = currentOffset;
			while (vtx[currentOffset] !== 0) currentOffset++;
			var sourceProgram = String.fromCharCode.apply(null, vtx.subarray(sourceProgramOffset, currentOffset));
			currentOffset++;

			var editorProgramOffset = currentOffset;
			while (vtx[currentOffset] !== 0) currentOffset++;
			var editorProgram = String.fromCharCode.apply(null, vtx.subarray(editorProgramOffset, currentOffset));
			currentOffset++;

			var commentOffset = currentOffset;
			while (vtx[currentOffset] !== 0) currentOffset++;
			var comment = String.fromCharCode.apply(null, vtx.subarray(commentOffset, currentOffset));
			currentOffset++;

			var lha = new Cowbell.Common.LhaReader(
				new Cowbell.Common.LhaArrayReader(vtx), 'lh5'
			);
			var unpackedData = lha.extract(currentOffset, unpackedSize, function(done, total) {
				if (done < total) return;

				var streamLength = unpackedSize / 14;
				var registerLog = [];
				var lastEnvelopeVal = 0;

				for (var i = 0; i < streamLength; i++) {
					var registers = [];
					for (var chan = 0; chan < 14; chan++) {
						var val = unpackedData[chan * streamLength + i];
						if (chan < 13) {
							registers[chan] = val;
						} else {
							if (val == 0xff) {
								registers[13] = lastEnvelopeVal;
								registers[14] = false;
							} else {
								registers[13] = val;
								lastEnvelopeVal = val;
								registers[14] = true;
							}
						}
					}

					registerLog[i] = registers;
				}

				onReady({
					'ayRegisterLog': registerLog,
					'ayFrequency': ayFrequency,
					'commandFrequency': commandFrequency,
					'panning': panning
				});

			});
		});
	}


	Cowbell.Player.VTX = function(url) {
		return new Cowbell.Common.WebAudioPlayer(url, VTXGenerator);
	};
})();
