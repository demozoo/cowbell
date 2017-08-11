LIBOPENMPT_BUILD_VERSION = 8745

DIST_FILES=\
	dist/cowbell/cowbell.min.js \
	dist/cowbell/ay_chip.min.js \
	dist/cowbell/vtx.min.js \
	dist/cowbell/zx.min.js \
	dist/cowbell/jssid.min.js \
	dist/cowbell/libopenmpt.js \
	dist/cowbell/libopenmpt.js.mem \
	dist/cowbell/openmpt.min.js \
	dist/doc/api.md \
	dist/doc/usage.md \
	dist/doc/LICENSE

.PHONY: all
all: $(DIST_FILES)

dist/cowbell/cowbell.min.js: cowbell/cowbell.js cowbell/ui/basic.js cowbell/ui/roundel.js cowbell/audio_player.js cowbell/web_audio_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/cowbell.js --js=cowbell/ui/basic.js --js=cowbell/ui/roundel.js \
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

dist/cowbell/zx.min.js: build/z80.js cowbell/zx_spectrum/stc_player.js build/pt3_player_bin.js cowbell/zx_spectrum/pt3_player.js build/sqt_player_bin.js cowbell/zx_spectrum/sqt_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=build/z80.js \
		--js=cowbell/zx_spectrum/stc_player.js \
		--js=build/pt3_player_bin.js --js=cowbell/zx_spectrum/pt3_player.js \
		--js=build/sqt_player_bin.js --js=cowbell/zx_spectrum/sqt_player.js \
		--js_output_file=dist/cowbell/zx.min.js

dist/cowbell/libopenmpt.js: cowbell/openmpt/libopenmpt.js
	mkdir -p dist/cowbell/
	cp cowbell/openmpt/libopenmpt.js dist/cowbell/libopenmpt.js

dist/cowbell/libopenmpt.js.mem: cowbell/openmpt/libopenmpt.js.mem
	mkdir -p dist/cowbell/
	cp cowbell/openmpt/libopenmpt.js.mem dist/cowbell/libopenmpt.js.mem

dist/cowbell/openmpt.min.js: cowbell/openmpt/openmpt_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/openmpt/openmpt_player.js \
		--js_output_file=dist/cowbell/openmpt.min.js

dist/cowbell/jssid.min.js: cowbell/jssid.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/jssid.js \
		--js_output_file=dist/cowbell/jssid.min.js

dist/doc/api.md: doc/api.md
	mkdir -p dist/doc/
	cp doc/api.md dist/doc/api.md

dist/doc/usage.md: doc/usage.md
	mkdir -p dist/doc/
	cp doc/usage.md dist/doc/usage.md

dist/doc/LICENSE: LICENSE
	mkdir -p dist/doc/
	cp LICENSE dist/doc/LICENSE

build/z80.js: cowbell/zx_spectrum/z80.coffee
	mkdir -p build
	coffee -c -o build/ cowbell/zx_spectrum/z80.coffee

build/pt3_player_bin.js: build/pt3_player.bin
	mkdir -p build
	perl bin2js.pl build/pt3_player.bin Cowbell.Common.PT3PlayerBin > build/pt3_player_bin.js

build/pt3_player.bin: cowbell/zx_spectrum/pt3_player.asm
	mkdir -p build
	pasmo cowbell/zx_spectrum/pt3_player.asm build/pt3_player.bin

build/sqt_player_bin.js: build/sqt_player.bin
	mkdir -p build
	perl bin2js.pl build/sqt_player.bin Cowbell.Common.SQTPlayerBin > build/sqt_player_bin.js

build/sqt_player.bin: cowbell/zx_spectrum/sqt_player.asm
	mkdir -p build
	pasmo cowbell/zx_spectrum/sqt_player.asm build/sqt_player.bin

.PHONY: clean
clean:
	rm -rf build dist

.PHONY: libopenmpt
libopenmpt:
	mkdir -p build
	cd build && \
	svn checkout -r $(LIBOPENMPT_BUILD_VERSION) https://source.openmpt.org/svn/openmpt/trunk/OpenMPT/ openmpt-trunk && \
	cd openmpt-trunk/ && \
	make clean && \
	make CONFIG=emscripten HACK_ARCHIVE_SUPPORT=1 USE_MINIMP3=1 && \
	cp bin/libopenmpt.js bin/libopenmpt.js.mem ../../cowbell/openmpt/
