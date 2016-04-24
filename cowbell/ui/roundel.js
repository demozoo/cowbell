/* Basic UI for the Cowbell audio player */

Cowbell.UI.Roundel = function(container) {
	var audioElement = null;
	var currentTrack = null;

	function createSVGElement(name, attrs) {
		var elem = document.createElementNS("http://www.w3.org/2000/svg", name);
		if (attrs) {
			for (var attrName in attrs) {
				elem.setAttribute(attrName, attrs[attrName]);
			}
		}
		return elem;
	}

	var canvas = createSVGElement('svg', {'width': '100', 'height': '100'});

	var progress = createSVGElement('g');
	canvas.appendChild(progress);

	var progressBackground = createSVGElement('circle', {
		'cx': '50', 'cy': '50', 'r': '48', 'fill': 'white'
	});
	progress.appendChild(progressBackground);

	var progressBar = createSVGElement('path', {'fill': 'grey'});
	progress.appendChild(progressBar);

	var progressOutline = createSVGElement('circle', {
		'cx': '50', 'cy': '50', 'r': '48',
		'stroke': 'black', 'stroke-width': '2px', 'fill': 'none'
	});
	progress.appendChild(progressOutline);

	var button = createSVGElement('g');
	canvas.appendChild(button);

	var buttonBase = createSVGElement('circle', {
		'cx': '50', 'cy': '50', 'r': '35',
		'stroke-width': '2px', 'fill': 'white'
	});
	button.appendChild(buttonBase);

	var playIcon = createSVGElement('polygon', {
		'points': '35,30 35,70 75,50'
	});
	button.appendChild(playIcon);

	var pauseIcon = createSVGElement('path', {
		'd': 'M35,30 L35,70 L45,70 L45,30 L35,30 M55,30 L55,70 L65,70 L65,30, L55,30',
		'fill': 'black'
	});
	pauseIcon.style.display = "none";
	button.appendChild(pauseIcon);

	container.appendChild(canvas);

	function showProgress() {
		progress.style.display = 'inline';
	}
	function hideProgress() {
		setProgress(0, 0);
		progress.style.display = 'none';
	}
	function setProgress(val, frac) {
		angle = frac * 2 * Math.PI;
		endX = 50 + 48 * Math.sin(angle);
		endY = 50 - 48 * Math.cos(angle);
		progressBar.setAttribute(
			"d",
			"M50,50 L50,2 A48,48 0 " + (frac >= 0.5 ? "1" : "0") + ",1 " + endX + "," + endY + " Z"
		);
	}
	function disablePlayButton() {
		playIcon.setAttribute("fill", "silver");
		buttonBase.setAttribute("stroke", "silver");
	}
	function enablePlayButton() {
		playIcon.setAttribute("fill", "black");
		buttonBase.setAttribute("stroke", "black");
	}

	hideProgress();
	disablePlayButton();

	function initAudioElement() {
		audioElement = currentTrack.open();
		audioElement.onplay = function() {
			playIcon.style.display = 'none';
			pauseIcon.style.display = 'inline';
			buttonBase.setAttribute('fill', 'white');
			canvas.style.cursor = 'default';
			showProgress();
		};
		audioElement.onpause = function() {
			pauseIcon.style.display = 'none';
			playIcon.style.display = 'inline';
		};
		audioElement.ontimeupdate = function() {
			if (audioElement && audioElement.duration) {
				setProgress(
					audioElement.currentTime,
					audioElement.currentTime / audioElement.duration
				);
			}
		};
		audioElement.onended = function() {
			hideProgress();
		};
	}

	button.onclick = function() {
		if (!currentTrack) return;
		if (!audioElement) {
			buttonBase.setAttribute('fill', 'silver');
			canvas.style.cursor = 'progress';
			initAudioElement();
		}
		if (audioElement.paused) {
			audioElement.play();
		} else {
			audioElement.pause();
		}
	};

	function setTimeByCanvasCoords(x, y) {
		if (audioElement && audioElement.duration) {
			var angle = Math.atan2(x - 50, 50 - y);
			var frac = (angle / (Math.PI * 2) + 1) % 1;
			var currentTime = audioElement.duration * frac;
			audioElement.currentTime = currentTime;
			setProgress(currentTime, frac);
		}
	}

	var mouseUp = function(e) {
		canvas.removeEventListener('mousemove', mouseMove);
		window.removeEventListener('mouseup', mouseUp);
		canvas.style.cursor = 'default';
	};
	var mouseMove = function(e) {
		setTimeByCanvasCoords(e.offsetX, e.offsetY);
	};
	progress.onmousedown = function(e) {
		setTimeByCanvasCoords(e.offsetX, e.offsetY);
		window.addEventListener('mouseup', mouseUp);
		canvas.addEventListener('mousemove', mouseMove);
		canvas.style.cursor = 'pointer';
	};

	this.open = function(track) {
		if (audioElement && !audioElement.paused) {
			audioElement.pause();
		}
		if (currentTrack && currentTrack.close) {
			currentTrack.close();
		}
		currentTrack = track;
		audioElement = null;
		hideProgress();
		enablePlayButton();
	};
};
