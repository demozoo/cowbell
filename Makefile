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
	cat cowbell/cowbell.js cowbell/ui/basic.js cowbell/ui/roundel.js cowbell/audio_player.js \
		cowbell/web_audio_player.js | minify --outFile dist/cowbell/cowbell.min.js

dist/cowbell/ay_chip.min.js: cowbell/ay_chip/ay_chip.js cowbell/ay_chip/psg_player.js
	mkdir -p dist/cowbell/
	cat cowbell/ay_chip/ay_chip.js cowbell/ay_chip/psg_player.js \
		| minify --outFile dist/cowbell/ay_chip.min.js

dist/cowbell/vtx.min.js: cowbell/ay_chip/lh4.js cowbell/ay_chip/vtx_player.js
	mkdir -p dist/cowbell/
	cat cowbell/ay_chip/lh4.js cowbell/ay_chip/vtx_player.js \
		| minify --outFile dist/cowbell/vtx.min.js

dist/cowbell/zx.min.js: build/z80.js cowbell/zx_spectrum/stc_player.js build/pt3_player_bin.js cowbell/zx_spectrum/pt3_player.js build/sqt_player_bin.js cowbell/zx_spectrum/sqt_player.js
	mkdir -p dist/cowbell/
	cat build/z80.js cowbell/zx_spectrum/stc_player.js build/pt3_player_bin.js \
		cowbell/zx_spectrum/pt3_player.js build/sqt_player_bin.js cowbell/zx_spectrum/sqt_player.js \
		| minify --outFile dist/cowbell/zx.min.js

dist/cowbell/libopenmpt.js: cowbell/openmpt/libopenmpt.js
	mkdir -p dist/cowbell/
	cp cowbell/openmpt/libopenmpt.js dist/cowbell/libopenmpt.js

dist/cowbell/libopenmpt.wasm: cowbell/openmpt/libopenmpt.wasm
	mkdir -p dist/cowbell/
	cp cowbell/openmpt/libopenmpt.wasm dist/cowbell/libopenmpt.wasm

dist/cowbell/openmpt.min.js: cowbell/openmpt/openmpt_player.js
	mkdir -p dist/cowbell/
	minify cowbell/openmpt/openmpt_player.js --outFile dist/cowbell/openmpt.min.js

dist/cowbell/libpsgplay.js: cowbell/psgplay/libpsgplay.js
	mkdir -p dist/cowbell/
	cp cowbell/psgplay/libpsgplay.js dist/cowbell/libpsgplay.js

dist/cowbell/libpsgplay.wasm: cowbell/psgplay/libpsgplay.wasm
	mkdir -p dist/cowbell/
	cp cowbell/psgplay/libpsgplay.wasm dist/cowbell/libpsgplay.wasm

dist/cowbell/psgplay.min.js: cowbell/psgplay/psgplay_player.js
	mkdir -p dist/cowbell/
	minify cowbell/psgplay/psgplay_player.js --outFile dist/cowbell/psgplay.min.js

dist/cowbell/jssid.min.js: cowbell/jssid.js
	mkdir -p dist/cowbell/
	minify cowbell/jssid.js --outFile dist/cowbell/jssid.min.js

dist/cowbell/asap.min.js: cowbell/asap/asap.js cowbell/asap/asap_player.js
	mkdir -p dist/cowbell/
# --typeConstructors.number false prevents minify from eliminating a Number()
# constructor that's necessary to cast from BigInt.
	cat cowbell/asap/asap.js cowbell/asap/asap_player.js \
		| minify --outFile dist/cowbell/asap.min.js --typeConstructors.number false

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
	git -C "psgplay" pull || git clone --recurse-submodules https://github.com/frno7/psgplay.git "psgplay"
	cd build/psgplay/ && \
	make clean
	cd build/psgplay/ && \
	make HOST_CC=emcc HOST_CFLAGS=-O2 V=1 -j"$(getconf _NPROCESSORS_ONLN)" web
	cd build/psgplay/ && \
	cp lib/psgplay/libpsgplay.js ../../cowbell/psgplay/libpsgplay.js && \
	cp lib/psgplay/libpsgplay.wasm ../../cowbell/psgplay/libpsgplay.wasm
