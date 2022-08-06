Cowbell
=======

Cowbell is an HTML / JavaScript audio player that can play diverse audio file formats with a common user interface, with a particular focus on the demoscene and tracker music.

Example
-------
[Working demonstration](https://demozoo.github.io/cowbell/)

Features
--------

### Support for lots of file formats

MP3, OGG (and whatever else your browser supports natively), MOD, XM, S3M, IT (and all other formats implemented by libopenmpt), SID, SAP (and other Atari 8-bit formats implemented by ASAP), SNDH, PSG, VTX, STC, SQT and PT3 formats

### Highly accurate playback engines

Getting every last detail and edge case of demoscene music formats right is hard, and so Cowbell is built on top of existing tried-and-tested playback engines. For tracker music formats, we use an Emscripten build of libopenmpt, the most mature and comprehensively-tested module player library available. Players for ZX Spectrum formats are either a direct translation of the original Z80 player routines, or the Z80 player routines themselves running under emulation.

### Play / pause / seek controls

...because it wouldn't be much of a music player without them.

### Modular design

Up to now, there's been no common API for things that generate audio data, so music players for 'exotic' formats tend to implement the whole pipeline themselves, including the audio output and user interface. This makes it difficult to create a single UI that works across multiple player backends. Cowbell adopts a simplified subset of the HTML Media element API (as used by the `<audio>` element) as the communication layer between player backends and the UI - new user interfaces can be built on top of a few basic methods and accessors such as `play`, `pause` and `currentTime`.

Cowbell also provides a wrapper to simplify the creation of Web Audio API based backends - backends just need to provide implementations of 'fill this buffer with audio data' and 'seek to time T', and the wrapper will take care of the fiddly details of pausing and buffering.

### Lazy loading

Audio files, and heavyweight libraries such as libopenmpt, are only loaded at the point of pressing play - so you can embed players into your pages without bloating the page for the rest of your users.


Usage
-----

See `doc/usage.md`.


Building
--------

Requires CoffeeScript, Pasmo <http://pasmo.speccy.org>, Closure Compiler, Perl and Make. (If you aren't filled with joy at the idea of installing a bunch of one-off build tools, or you're on a platform that makes that difficult, I'd recommend installing under a Vagrant virtual machine - an install script is provided to set up an Ubuntu VM with the necessary packages in place. With Vagrant installed, run `vagrant up` then `vagrant ssh` from the project root, and then at the VM's command prompt, `cd /vagrant`.)

With all that done, run:

    make

from the root level.

This setup does not include Emscripten <http://emscripten.org/>, required to build the libopenmpt library. To include this (an addition which requires 4Gb of memory and possibly an hour or more of build time), you should instead run `vagrant up emscripten` then `vagrant ssh emscripten`. You can then edit the `LIBOPENMPT_BUILD_VERSION` line in the Makefile to point to the libopenmpt version you wish to build, and then run:

    make libopenmpt


Authors
-------

Framework code and AY / Z80 emulation by Matt Westcott; Z80 implementation based on the [Fuse](http://fuse-emulator.sourceforge.net/) ZX Spectrum emulator by Philip Kendall, Fredrick Meunier and others.

[Libopenmpt](http://lib.openmpt.org/libopenmpt/) by Jörn Heusipp, Johannes Schultz and others.

[Original LH4 decompression code](https://github.com/erlandranvinge/lh4.js/tree/master) (for VTX file format) by Erland Ranvinge, based on a mix of Nobuyasu Suehiro's Java implementation and Simon Howard's C version.

ZX Spectrum Protracker 3 playback routine (Z80 code) by Sergey Bulba and Ivan Roshin, from the [Vortex Tracker 2](http://bulba.untergrund.net/main_e.htm) project.

jsSID .sid player by [Mihaly Horvath (Hermit)](http://hermit.sidrip.com).

.sap / Atari 8-bit format support from [ASAP (Another Slight Atari Player)](http://asap.sourceforge.net/) by Piotr Fusik (Fox) and others.

.sndh player ([psgplay](https://github.com/frno7/psgplay)) by Fredrik Noring ([NoRing](https://demozoo.org/sceners/2515/)) and others.


Contact
-------
Matt Westcott <matt@west.co.tt> - https://twitter.com/gasmanic
