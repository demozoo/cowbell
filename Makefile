DIST_FILES=\
	dist/cowbell/cowbell.min.js \
	dist/cowbell/ay_chip.min.js \
	dist/cowbell/vtx.min.js \
	dist/cowbell/zx.min.js \
	dist/cowbell/libopenmpt.js \
	dist/cowbell/openmpt_player.js

.PHONY: all
all: $(DIST_FILES)

dist/cowbell/cowbell.min.js: cowbell/cowbell.js cowbell/ui/basic.js cowbell/audio_player.js cowbell/web_audio_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/cowbell.js --js=cowbell/ui/basic.js \
		--js=cowbell/audio_player.js --js=cowbell/web_audio_player.js \
		--js_output_file=dist/cowbell/cowbell.min.js

dist/cowbell/ay_chip.min.js: cowbell/ay_chip/ay_chip.js cowbell/ay_chip/psg_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/ay_chip/ay_chip.js --js=cowbell/ay_chip/psg_player.js \
		--js_output_file=dist/cowbell/ay_chip.min.js

dist/cowbell/vtx.min.js: cowbell/ay_chip/lh4.js cowbell/ay_chip/vtx_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/ay_chip/lh4.js --js=cowbell/ay_chip/vtx_player.js \
		--js_output_file=dist/cowbell/vtx.min.js

dist/cowbell/zx.min.js: build/z80.js build/stc_player_bin.js cowbell/zx_spectrum/stc_player.js build/pt3_player_bin.js cowbell/zx_spectrum/pt3_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=build/z80.js \
		--js=build/stc_player_bin.js --js=cowbell/zx_spectrum/stc_player.js \
		--js=build/pt3_player_bin.js --js=cowbell/zx_spectrum/pt3_player.js \
		--js_output_file=dist/cowbell/zx.min.js

dist/cowbell/libopenmpt.js: cowbell/openmpt/libopenmpt.js
	mkdir -p dist/cowbell/
	cp cowbell/openmpt/libopenmpt.js dist/cowbell/libopenmpt.js

dist/cowbell/openmpt_player.js: cowbell/openmpt/openmpt_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/openmpt/openmpt_player.js \
		--js_output_file=dist/cowbell/openmpt.min.js

build/z80.js: cowbell/zx_spectrum/z80.coffee
	mkdir -p build
	coffee -c -o build/ cowbell/zx_spectrum/z80.coffee

build/stc_player_bin.js: build/stc_player.bin
	mkdir -p build
	perl bin2js.pl build/stc_player.bin Cowbell.Common.STCPlayerBin > build/stc_player_bin.js

build/pt3_player_bin.js: build/pt3_player.bin
	mkdir -p build
	perl bin2js.pl build/pt3_player.bin Cowbell.Common.PT3PlayerBin > build/pt3_player_bin.js

build/stc_player.bin: cowbell/zx_spectrum/stc_player.asm
	mkdir -p build
	pasmo cowbell/zx_spectrum/stc_player.asm build/stc_player.bin

build/pt3_player.bin: cowbell/zx_spectrum/pt3_player.asm
	mkdir -p build
	pasmo cowbell/zx_spectrum/pt3_player.asm build/pt3_player.bin

.PHONY: clean
clean:
	rm -rf build dist
