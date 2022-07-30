LIBOPENMPT_TAG = libopenmpt-0.6.4

DIST_FILES=\
	dist/cowbell/cowbell.min.js \
	dist/cowbell/ay_chip.min.js \
	dist/cowbell/vtx.min.js \
	dist/cowbell/zx.min.js \
	dist/cowbell/jssid.min.js \
	dist/cowbell/asap.min.js \
	dist/cowbell/libopenmpt.js \
	dist/cowbell/libopenmpt.wasm \
	dist/cowbell/openmpt.min.js \
	dist/cowbell/libpsgplay.js \
	dist/cowbell/libpsgplay.wasm \
	dist/cowbell/psgplay.min.js \
	dist/doc/api.md \
	dist/doc/usage.md \
	dist/doc/LICENSE \
	dist/doc/README.md \
	dist/doc/CHANGELOG.txt

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

dist/cowbell/libopenmpt.wasm: cowbell/openmpt/libopenmpt.wasm
	mkdir -p dist/cowbell/
	cp cowbell/openmpt/libopenmpt.wasm dist/cowbell/libopenmpt.wasm

dist/cowbell/openmpt.min.js: cowbell/openmpt/openmpt_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/openmpt/openmpt_player.js \
		--js_output_file=dist/cowbell/openmpt.min.js

dist/cowbell/libpsgplay.js: cowbell/psgplay/libpsgplay.js
	mkdir -p dist/cowbell/
	cp cowbell/psgplay/libpsgplay.js dist/cowbell/libpsgplay.js

dist/cowbell/libpsgplay.wasm: cowbell/psgplay/libpsgplay.wasm
	mkdir -p dist/cowbell/
	cp cowbell/psgplay/libpsgplay.wasm dist/cowbell/libpsgplay.wasm

dist/cowbell/psgplay.min.js: cowbell/psgplay/psgplay_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/psgplay/psgplay_player.js \
		--js_output_file=dist/cowbell/psgplay.min.js

dist/cowbell/jssid.min.js: cowbell/jssid.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/jssid.js \
		--js_output_file=dist/cowbell/jssid.min.js

dist/cowbell/asap.min.js: cowbell/asap/asap.js cowbell/asap/asap_player.js
	mkdir -p dist/cowbell/
	closure-compiler \
		--js=cowbell/asap/asap.js --js=cowbell/asap/asap_player.js \
		--js_output_file=dist/cowbell/asap.min.js

dist/doc/api.md: doc/api.md
	mkdir -p dist/doc/
	cp doc/api.md dist/doc/api.md

dist/doc/usage.md: doc/usage.md
	mkdir -p dist/doc/
	cp doc/usage.md dist/doc/usage.md

dist/doc/LICENSE: LICENSE
	mkdir -p dist/doc/
	cp LICENSE dist/doc/LICENSE

dist/doc/README.md: README.md
	mkdir -p dist/doc/
	cp README.md dist/doc/README.md

dist/doc/CHANGELOG.txt: CHANGELOG.txt
	mkdir -p dist/doc/
	cp CHANGELOG.txt dist/doc/CHANGELOG.txt

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
	svn checkout https://source.openmpt.org/svn/openmpt/tags/$(LIBOPENMPT_TAG) openmpt && \
	cd openmpt/ && \
	make clean && \
	export LDFLAGS="-s \"EXPORTED_RUNTIME_METHODS=['stackAlloc','stackSave','stackRestore']\"" && \
	make CONFIG=emscripten HACK_ARCHIVE_SUPPORT=1 USE_MINIMP3=1 && \
	cp bin/libopenmpt.js bin/libopenmpt.wasm ../../cowbell/openmpt/

.PHONY: libpsgplay
libpsgplay:
	mkdir -p build
	cd build && \
	git -C "psgplay" pull || git clone https://github.com/tin-nl/psgplay_emscripten.git "psgplay" 
	cd build/psgplay/ && \
	make clean
	#make native tools needed for emscripten build
	cd build/psgplay/ && \
	export CFLAGS="-g -O2 -Wall -fPIC -Iinclude -D_GNU_SOURCE" && \
	make CC=gcc -f lib/m68k/Makefile emscripten
	cd build/psgplay/ && \
	export SOFLAGS="-s ASYNCIFY -s EXPORT_NAME=\"'libpsgplay'\" -s EXPORTED_FUNCTIONS='[\"_psgplay_init\",\"_psgplay_read_stereo\",\"_psgplay_free\",\"_ice_identify\",\"_ice_decrunched_size\",\"_ice_decrunch\",\"_sndh_tag_default_subtune\",\"_sndh_tag_subtune_time\",\"_malloc\",\"_free\"]' -s EXPORTED_RUNTIME_METHODS=ccall,cwrap" && \
	export CROSS_COMPILE=  && \
	emmake make emscripten && \
	cp lib/psgplay/libpsgplay.js lib/psgplay/libpsgplay.wasm ../../cowbell/psgplay/
