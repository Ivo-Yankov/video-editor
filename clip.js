module.exports = {
	file : '',
	start : 0,
	end: 0,
	layer: 0,
	timeline_start: 0,
	timeline_end: 0,
	duration: 0,
	top_left_x: 0,
	top_left_y: 0,
	bottom_right_x: 0,
	bottom_right_y: 0,
	sound_level: 100,

	video: function( args ){
		var props_to_assign = ['file', 'start', 'end', 'layer',
		'timeline_start', 'timeline_end', 'duration', 'top_left_x',
		'top_left_y', 'bottom_right_y', 'bottom_right_x'];


		for ( prop in props_to_assign ){
			this[prop] = args[prop];
		}

		this['sound_level'] = 0;

		return this;
	},

	audio: function( args ){
		var props_to_assign = ['file', 'start', 'end', 'sound_level'];

		for ( prop in props_to_assign ){
			this[prop] = args[prop];
		}

		return this;
	}
}