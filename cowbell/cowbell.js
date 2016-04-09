window.Cowbell = {
	'UI': {},
	'Player': {},
	'Common': {}
};

window.Cowbell.createPlayer = function(containerElement, opts) {
	if (!opts) opts = {};

	if (typeof(containerElement) == 'string') {
		containerElement = document.getElementById(containerElement);
	}

	var uiConstructor = opts.ui || Cowbell.UI.Basic;
	var ui = new uiConstructor(containerElement);

	if (opts.player) {
		var player = new opts.player(opts.playerOpts);

		if (opts.url) {
			var track = new player.Track(opts.url, opts.trackOpts);
			ui.open(track);
		}
	}

	return ui;
};

if (window.jQuery) {
	window.jQuery.fn.cowbell = function(opts) {
		this.each(function() {
			Cowbell.createPlayer(this, opts);
		});
	};
}
