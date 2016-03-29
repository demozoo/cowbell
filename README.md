Cowbell
=======

Cowbell is an HTML / JavaScript audio player that can play diverse audio file formats with a common user interface, with a particular focus on the demoscene and tracker music


Features
--------

* Support for MP3, OGG (and whatever else your browser supports natively), MOD, XM, S3M, IT (and all other formats implemented by libopenmpt), PSG, VTX, STC and PT3 formats
* Modular design - new UI frontends can be built to work with all existing player formats, and vice versa
* Lazy loading - audio files (and heavyweight libraries such as libopenmmt) are only loaded at the point of pressing play


Building
--------

Requires CoffeeScript, Pasmo <http://pasmo.speccy.org>, Closure Compiler, Perl and Make. Run:

    make

from the root level.


Authors
-------

Framework code and AY / Z80 emulation by Matt Westcott; Z80 implementation based on the Fuse ZX Spectrum emulator by Philip Kendall, Fredrick Meunier and others.

Libopenmpt by ?; Javascript / Emscripten build taken from chiptune2.js by Simon Gündling.

Original LH4 decompression code (for VTX file format) by Erland Ranvinge, based on a mix of Nobuyasu Suehiro's Java implementation and Simon Howard's C version.

Soundtracker playback routine (Z80 code) by BZYK.

Protracker 3 playback routine (Z80 code) by Sergey Bulba and Ivan Roshin.
