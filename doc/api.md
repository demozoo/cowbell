Cowbell API documentation
=========================

This document contains the information you need to write UI and player backend modules. For basic usage instructions, see `usage.md`.

TL;DR
-----

If you want to implement a player backend that works by filling a buffer with wave data, look at `WebAudioPlayer` and the `Generator` API. (Consulting the source code for `OpenMPTGenerator` in cowbell/openmpt/openmpt_player.js will also help.)

If you want to implement a player backend that generates audio through some other mechanism (e.g. Web Audio `OscillatorNode`s), look at the `Player` API.

If you want to implement a new kind of player UI widget, look at the `UI` API. (Consulting the source code for `Cowbell.UI.Basic` in cowbell/ui/basic.js will also help.)

`Player`
--------

A `Player` object implements a single method, `Track`. This is invoked as a constructor (`new player.Track(url, opts)`) and returns a `Track` object for a given URL and (optionally) options dictionary.

    // create a Player object
    var stcPlayer = new Cowbell.Player.ZXSTC();
    
    // obtain a Track object from the player
    var track = new stcPlayer.Track('music/worlds_apart.stc', {
        stereoMode: 'ACB'
    });

The URL should not be fetched at this point; that should happen on `track.open()`.

`Track`
-------

A `Track` object implements the method `open()`, which fetches the track data and returns an `AudioElement` object.

    var audioElement = track.open();
    
Optionally, it can also implement the method `close()`, which releases any resources associated with the track.

    track.close();
    
`AudioElement`
--------------

An `AudioElement` object is the thing that actually produces sound, implementing a subset of [the HTML `<audio>` element API](https://html.spec.whatwg.org/multipage/embedded-content.html#the-audio-element) - most importantly, a `play()` method that begins playback. Cowbell does not dictate any particular method of generating sound - it could be done through an actual `<audio>` element, or [Web Audio](https://www.w3.org/TR/webaudio/), or something entirely different such as a Flash embed, provided it follows the API. The properties and methods it needs to implement are:

* `audioElement.HAVE_NOTHING`, `audioElement.HAVE_METADATA`, `audioElement.HAVE_CURRENT_DATA`, `audioElement.HAVE_FUTURE_DATA`, `audioElement.HAVE_ENOUGH_DATA` - constants equal to 0, 1, 2, 3, 4 respectively
* `audioElement.readyState` - read-only, equals one of the above constants to indicate how much data has been loaded
* `audioElement.duration` - read-only, indicates the length of the track in seconds; valid when `readyState` is `HAVE_METADATA` or above
* `audioElement.play()` - begin or resume playback
* `audioElement.pause()` - pause playback
* `audioElement.paused` - read-only, indicates whether playback is currently paused
* `audioElement.seekable` - read-only, returns a TimeRanges object representing the time ranges we can seek to; in practice, UIs will not support partially seekable tracks, and will treat any object returned here with a `length` property of 0 as "not seekable", and a `length` property greater than 0 as "fully seekable"
* `audioElement.currentTime` - read/write, returns the current playback position in seconds or can be set to seek to a given position
* `audioElement.onloadedmetadata` - event handler fired when metadata has been loaded (i.e. `audioElement.duration` becomes available)
* `audioElement.onplay` - event handler fired when playback has started or resumed
* `audioElement.onpause` - event handler fired when playback has been paused
* `audioElement.ontimeupdate` - event handler fired at regular intervals while the playback position is advancing
* `audioElement.onended` - event handler fired when playback has reached the end of the track

`UI`
----

A `UI` object handles the appearance and behaviour of player controls. The constructor for this object accepts DOM element object as its first parameter, indicating where the player controls should be inserted:

    var container = document.getElementById('player-controls');
    var playerUI = new Cowbell.UI.Basic(container);

The `UI` object provides a single method `open`, which receives a `Track` object:

    playerUI.open(track);

From that point on, the player controls will then act on the given track - so, for example, clicking the UI's play button will trigger a call to `track.open()` to obtain an `AudioElement`, and then call `play()` on it. The UI should avoid calling `track.open()` until the user interacts with the player controls, to ensure that the audio file does not get unnecessarily downloaded on every page view.

The `UI` object must be able to handle subsequent calls to `open(track)`, to allow switching to a new track. In this case it is the `UI`'s responsibility to check whether the previous track provides a `close()` method, and call it if so.

`Generator`
-----------

For file formats that are not natively playable by the browser, a `Player` backend will almost always be implemented as a chunk of JavaScript code that generates wave audio data to be played via the [Web Audio API](https://www.w3.org/TR/webaudio/). If your `Player` backend falls into this category, then Cowbell provides a wrapper, `Cowbell.Common.WebAudioPlayer`, to simplify the task - you just need to write the low-level code for filling a buffer with audio data and seeking to a specific point, and `WebAudioPlayer` will deal with the messy details of buffering, pausing and keeping track of playback position. The definition of a `Player` backend object based on `WebAudioPlayer` will look like this:

    Cowbell.Player.XYZFormat = function(opts) {
        return new Cowbell.Common.WebAudioPlayer(XYZGenerator, opts);
    };

where `opts` is a dictionary of options specific to the player backend. The generator object passed as the first parameter to `WebAudioPlayer` then needs to implement the following API:

* `generator = new Generator(url, audioCtx, playerOpts, trackOpts);` - the constructor for the `Generator` object receives the URL to the track, the [AudioContext](https://www.w3.org/TR/webaudio/#AudioContext) object (primarily useful for finding out the sample rate, `audioCtx.sampleRate`), the player-specific options (possibly null) and the track-specific options (possibly null).
* `generator.load(onReadyCallback)` - open the audio file and call `onReadyCallback()` when the generator is ready to begin generating audio data. Before calling `onReadyCallback()` the properties `channelCount`, `duration` and `seekable` must be defined on the generator object.
* `generator.channelCount` - property indicating the number of output channels; WebAudioPlayer will return an AudioBuffer with this number of channels. This must be defined before the onReadyCallback passed to `generator.load` is called
* `generator.duration` - property indicating duration of the track in seconds. This must be defined before the onReadyCallback passed to `generator.load` is called
* `generator.seekable` - boolean property indicating whether it is possible to seek to an arbitrary position in this track
* `generator.generateAudio(outputBuffer)` - fill `outputBuffer` (an [AudioBuffer](https://www.w3.org/TR/webaudio/#AudioBuffer) object) with audio data, and return the number of audio frames written; writing less than the full buffer size indicates the end of the track
* `generator.reset()` - set the playback position (i.e. the data that will be generated on the next call to `generateAudio`) to the start of the track. Will be called before the first call to generateAudio, and when the track is stopped or reaches its end
* `generator.seek(timeInSeconds)` - required if `generator.seekable` is true; set the playback position (i.e. the data that will be generated on the next call to `generateAudio`) to `timeInSeconds`
* `generator.cleanup()` - release any resources associated with the loaded track
