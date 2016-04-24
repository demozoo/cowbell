/* Basic UI for the Cowbell audio player */

Cowbell.UI.Roundel = function(container) {
	var audioElement = null;
	var currentTrack = null;

	var xmlns = "http://www.w3.org/2000/svg";

	var canvas = document.createElementNS(xmlns, "svg");
	canvas.setAttribute("width", "100");
	canvas.setAttribute("height", "100");

	var progress = document.createElementNS(xmlns, "g");
	canvas.appendChild(progress);

	var progressBackground = document.createElementNS(xmlns, "circle");
	progressBackground.setAttribute("cx", "50");
	progressBackground.setAttribute("cy", "50");
	progressBackground.setAttribute("r", "48");
	progressBackground.setAttribute("fill", "white");
	progress.appendChild(progressBackground);

	var progressBar = document.createElementNS(xmlns, "path");
	progressBar.setAttribute("fill", "grey");
	progress.appendChild(progressBar);

	var progressOutline = document.createElementNS(xmlns, "circle");
	progressOutline.setAttribute("cx", "50");
	progressOutline.setAttribute("cy", "50");
	progressOutline.setAttribute("r", "48");
	progressOutline.setAttribute("stroke", "black");
	progressOutline.setAttribute("stroke-width", "2px");
	progressOutline.setAttribute("fill", "none");
	progress.appendChild(progressOutline);

	var button = document.createElementNS(xmlns, "g");
	canvas.appendChild(button);

	var buttonBase = document.createElementNS(xmlns, "circle");
	buttonBase.setAttribute("cx", "50");
	buttonBase.setAttribute("cy", "50");
	buttonBase.setAttribute("r", "35");
	buttonBase.setAttribute("stroke", "silver");  // disabled state
	buttonBase.setAttribute("stroke-width", "2px");
	buttonBase.setAttribute("fill", "white");
	button.appendChild(buttonBase);

	var playIcon = document.createElementNS(xmlns, "polygon");
	playIcon.setAttribute("points", "35,30 35,70 75,50");
	playIcon.setAttribute("fill", "silver");  // disabled state
	button.appendChild(playIcon);

	var pauseIcon = document.createElementNS(xmlns, "path");
	pauseIcon.setAttribute("d", "M35,30 L35,70 L45,70 L45,30 L35,30 M55,30 L55,70 L65,70 L65,30, L55,30");
	pauseIcon.setAttribute("fill", "black");
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

	hideProgress();

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
			initAudioElement();
		}
		if (audioElement.paused) {
			buttonBase.setAttribute('fill', 'silver');
			canvas.style.cursor = 'progress';
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
		playIcon.setAttribute("fill", "black");  // enabled state
		buttonBase.setAttribute("stroke", "black");  // enabled state
	};
};
