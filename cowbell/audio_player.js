/* Trivial player for formats that the browser supports natively through the <audio> element,
such as MP3 and OGG */

Cowbell.Player.Audio = function(url) {
	var audio = document.createElement('audio');
	audio.src = url;
	document.body.appendChild(audio);

	return audio;
};
