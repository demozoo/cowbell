/* Basic UI for the Cowbell audio player */

Cowbell.UI.Basic = function(container, backend, url) {
	var audioElement = null;

	var playButton = document.createElement('button');
	playButton.innerHTML = 'play';
	container.appendChild(playButton);
	var scrubber = document.createElement('input');
	scrubber.type = 'range';
	scrubber.min = 0;
	scrubber.value = 0;
	scrubber.disabled = true;
	container.appendChild(scrubber);

	scrubber.onchange = function() {
		audioElement.currentTime = scrubber.value / 100;
	};

	function initWithMetadata() {
		scrubber.max = audioElement.duration * 100;
	}

	function initAudioElement() {
		audioElement = backend.open(url);
		if (audioElement.readyState >= audioElement.HAVE_METADATA) {
			initWithMetadata();
		} else {
			audioElement.onloadedmetadata = initWithMetadata;
		}
		audioElement.onplay = function() {
			playButton.innerHTML = 'pause';
			playButton.disabled = false;
			scrubber.disabled = false;
		};
		audioElement.onpause = function() {
			playButton.innerHTML = 'play';
		};
		audioElement.ontimeupdate = function() {
			scrubber.value = audioElement.currentTime * 100;
		};
		audioElement.onended = function() {
			scrubber.value = 0;
			scrubber.disabled = true;
		};
	}

	playButton.onclick = function() {
		if (!audioElement) {
			initAudioElement();
		}
		if (audioElement.paused) {
			playButton.disabled = true;
			audioElement.play();
		} else {
			audioElement.pause();
		}
	};
};
