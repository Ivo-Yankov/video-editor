var fs = require('file-system');
var ffmpeg = require('fluent-ffmpeg');
var path = require('path');
var appDir = path.dirname(require.main.filename);
var clip = require(path.join(appDir, '/clip.js'));

module.exports = {
	ffmpeg : {},
	options : {},
	streams : {
		audio : [],
		video : [],
		last_audio_name : "a0",
		last_video_name : "base"
	},
	complex_filters : [],
	input_index : 0,

	render: function (data) {
		var clips = data.clips;

		console.log(clips);
		var resolution_width = "320";
		var resolution_height = "180";
		var resolution = resolution_width + "x" + resolution_height;
		var background = "black";
		var uploads_folder = '/public/';

		var eq_filters = {
			'contrast'		: 1,
			'brightness'	: 0,
			'saturation'	: 1,
			'gamma'			: 1,
			'gamma_r'		: 1,
			'gamma_g'		: 1,
			'gamma_b'		: 1
		};

		this.init();

		// Add base input
		this.addInput('color=' + background + ':s=' + resolution, {
			declaration: [ 'setpts=PTS+0/TB', 'scale=' + resolution ],
			overlay: [ 'overlay=shortest=1' ]
		}, {}, 'lavfi');

		var duration = 0;
		var there_is_video = false;
		var there_is_audio = false;
		for( var i = 0; i < clips.length; i++ ) {
			var clip = clips[i];
			clip.end = Number(clip.end);
			clip.start = Number(clip.start);

			var timeline_end = clip.end;
			if ( timeline_end > duration ) {
				duration = timeline_end;
			}

			var filepath =  path.join(__dirname, uploads_folder, clip.file);

			var video_options = {
				declaration: [],
				overlay : []
			};

			var audio_options = {
				start: clip.start,
				end: clip.end,
				filters: []
			};
			
			var offset = clip.offset;
			if ( clip.hasvideo ) {
				there_is_video = true;

				// Convert the width, heigh, top and left properties from percentages to pixels
				clip.top_left_x = parseInt(clip.left * resolution_width / 100);
				clip.top_left_y = parseInt(clip.top * resolution_height / 100);
				clip.bottom_right_x = parseInt(clip.top_left_x + clip.width * resolution_width / 100);
				clip.bottom_right_y = parseInt(clip.top_left_y + clip.height * resolution_height / 100);

				// Create the video declaration step filters
 				video_options.declaration.push( 'setpts=PTS+' + (clip.start - offset) + '/TB' );

	 			var width = clip.bottom_right_x - clip.top_left_x;
	 			var height = clip.bottom_right_y - clip.top_left_y;
 				video_options.declaration.push( 'scale=' + width + 'x' + height );

	 			video_options.declaration.push( 'trim=start=' + clip.start + ':end=' + (clip.end + offset) );

	 			if( clip.filters ) {
	 				var clip_eq_filters = [];
	 				for( var filter in clip.filters ) {
	 					if (clip.filters.hasOwnProperty(filter) ) {

	 						if ( eq_filters.hasOwnProperty(filter) ) {
	 							clip_eq_filters.push( filter + "=" + clip.filters[filter] );
	 						}

	 						if ( filter === "text" ) {

	 							var text_filters = [];
	 							if ( clip.filters[filter].text ) {
	 								if ( !clip.filters[filter].x ) {
	 									clip.filters[filter].x = "(w-tw)/2";
	 								}

	 								if ( !clip.filters[filter].y ) {
										clip.filters[filter].y = "h-(2*lh)";
	 								}

		 							for ( var text_filter in clip.filters[filter] ) {
		 								if ( clip.filters[filter].hasOwnProperty(text_filter) && clip.filters[filter][text_filter] ) {
	 										text_filters.push( text_filter + '=' + clip.filters[filter][text_filter] );
		 								}
		 							}

		 							video_options.declaration.push( "drawtext=" + text_filters.join(":") );
	 							}
	 						}
	 					}
	 				}

	 				if ( clip_eq_filters.length ) {
	 					video_options.declaration.push( "eq=" + clip_eq_filters.join(':') );
	 				}

	 				if ( clip.filters.reverse ) {
	 					video_options.declaration.push( "reverse" );
	 				}
	 			}

				// Create the video overlay step filter
				var overlay_filter = 'overlay=eof_action=pass';
	 			overlay_is_not_full_res = ( clip.top_left_x != 0 
	 				|| clip.top_left_y != 0 
	 				|| clip.bottom_right_x != resolution_width
	 				|| clip.bottom_right_y != resolution_height );

	 			if ( overlay_is_not_full_res ) {
	 				overlay_filter += ":x=" + clip.top_left_x + ":y=" + clip.top_left_y;
	 			}

	 			video_options.overlay.push( overlay_filter );
			}

			if ( clip.hasaudio ) {
				there_is_audio = true;

				var volume = 1;
				if ( clip.filters && clip.filters.volume ) {
					volume = clip.filters.volume;
				}

				// Create the audio filters
 				audio_options.filters.push( 'asetpts=PTS+' + (clip.start - offset) + '/TB' );

				audio_options.filters.push( 'atrim=start=' + clip.start + ':end=' + (clip.end + offset) );
				audio_options.filters.push( 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo' );

				if ( volume && volume !== 1 ) {
					audio_options.filters.push( 'volume=' + volume );
				}

				if ( clip.filters && clip.filters.reverse ) {
					audio_options.filters.push( 'areverse' );
				}
			}
			
			// Add the input
			if ( ! clip.file ) {
				if ( clip.hasvideo && clip.filters.background_color) {
					this.addInput(
						'color=' + clip.filters.background_color + ':s=' + width + 'x' + height,
						video_options,
						false,
						'lavfi');
				}
			}
			else {
				this.addInput(filepath, video_options, audio_options);
			}
		}

		//Create base video stream and set resolution
		var baseFilter = 'nullsrc='; 
		baseFilter += 'size=' + resolution;

		baseFilter += this.streamNameToString( this.streams.last_video_name );

		this.addFilter( baseFilter );

		//Declaration step
		//Declare video streams
		for ( var i = 0; i < this.streams.video.length; i++ ) {
			var stream = this.streams.video[i];

			if ( stream.options.declaration && stream.options.declaration.length ) {

				// Get input stream
				var filter = this.streamNameToString( stream.input_index + ":v" );

				// Apply declaration step options			
				filter += stream.options.declaration.join(',');

				// Give this stream a name
				filter += this.streamNameToString( stream.name );

				this.addFilter( filter );
				
			}
		}

		//Overlay step
		var overlay_index = 0;
		for ( var i = 0; i < this.streams.video.length; i++ ) {
			var stream = this.streams.video[i];
			if ( stream.options.overlay && stream.options.overlay.length ) {
				var filter = this.streamNameToString( this.streams.last_video_name ) + this.streamNameToString( stream.name );

				// Apply overlay step options			
				filter += stream.options.overlay.join(',');

				// Give a name to overlay
				var overlay_name = "o" + overlay_index;
				this.streams.last_video_name = overlay_name;

				//todo dont name the last overlay or map that stream to the output
				filter += this.streamNameToString( overlay_name );

				//note: it is possible that 
				overlay_index ++;

				this.addFilter( filter );
			}
		}



		//Audio step
		var amerge_filter = "";
		var amerge_count = 0;
		for ( var i = 0; i < this.streams.audio.length; i++ ) {
			filter = "";
			this.incrementAudioStreamName();
			concat_filter_start = "";
			concat_count = 1;
			var stream = this.streams.audio[i];
			if ( ! isEmpty( stream.options ) ) {

				// Audio does not start at 0
				if ( stream.options.start ) {
					filter = 'aevalsrc=0:s=48000:d=' + stream.options.start + this.streamNameToString( this.streams.last_audio_name );
					this.addFilter( filter );

					concat_filter_start = this.streamNameToString( this.streams.last_audio_name );

					this.incrementAudioStreamName();
					concat_count++;
				}

				filter = this.streamNameToString( stream.input_index + ":a" );
				filter += stream.options.filters.join(',');
				
				var audio_stream_name = this.streamNameToString( this.streams.last_audio_name ); 

				filter += audio_stream_name;
				
				if ( ! ( stream.options.start || stream.options.end < duration ) ) {
					amerge_count++;
					amerge_filter += this.streamNameToString( this.streams.last_audio_name );
				}

				this.incrementAudioStreamName();

				this.addFilter( filter );

				// Audio does not end at the end of the whole movie
				var concat_filter_end = "";
				if ( stream.options.end < duration ) {
					var end_silence_duration = duration - stream.options.end;
					filter = 'aevalsrc=0:s=48000:d=' + end_silence_duration + this.streamNameToString( this.streams.last_audio_name );
					this.addFilter( filter );

					concat_filter_end = this.streamNameToString( this.streams.last_audio_name );

					this.incrementAudioStreamName();	
					concat_count++;			
				}

				if ( stream.options.start || stream.options.end < duration ) {
					var concat_filter = concat_filter_start + audio_stream_name + concat_filter_end;
					concat_filter += "concat=n=" + concat_count + ":v=0:a=1";
					concat_filter += this.streamNameToString( this.streams.last_audio_name );
					this.addFilter( concat_filter );
					amerge_count++;
					amerge_filter += this.streamNameToString( this.streams.last_audio_name );
					// this.incrementAudioStreamName();
				}
			}
		}

		if ( amerge_count > 1 ) {
			this.incrementAudioStreamName();
			amerge_filter += "amerge=inputs=" + amerge_count;
			amerge_filter += this.streamNameToString( this.streams.last_audio_name );
			this.addFilter( amerge_filter );
		}
		else if( !concat_filter_start && !concat_filter_end && this.streams.last_audio_name != 'a0' ) {
			this.decrementAudioStreamName();
		}

		this.ffmpeg.complexFilter(this.complex_filters);

		// if (there_is_video) {
			this.ffmpeg.addOption('-map', this.streamNameToString( this.streams.last_video_name ) );
		// }

		if (there_is_audio) {
			this.ffmpeg.addOption('-map', this.streamNameToString( this.streams.last_audio_name ) );
			this.ffmpeg.addOption('-ac', 2 );
			this.ffmpeg.addOption('-b:a', '48k' );
		}
		this.ffmpeg.addOption('-t', duration );

		return this.ffmpeg;
	},

	init: function () {
		this.ffmpeg = {};
		this.options = {};
		this.streams = {
			audio : [],
			video : [],
			last_audio_name : "a0",
			last_video_name : "base"
		};
		this.complex_filters = [];
		this.input_index = 0;

		this.ffmpeg = ffmpeg();

		this.ffmpeg.on('progress', function(progress) {
			console.log('Processing: ' + progress.timemark);
		});

		this.ffmpeg.on('error', function(err, stdout, stderr) {
			console.log('Error: ' + err.message);
	        if ( stdout ) {
	        	console.log("stdout:\n" + stdout);
	        }
	        if ( stderr ) {
	        	console.log("stderr:\n" + stderr);
	        }
		});

		this.ffmpeg.on('end', function() {
			console.log('Processing finished!');
		});

		this.ffmpeg.on('start', function(commandLine) {
			console.log('Spawned Ffmpeg with command:');
			console.log('---------');
			console.log(commandLine);
			console.log('---------');
		});
	},

	setOutput: function(file){
		this.ffmpeg.output(file);
	},

	addInput: function(file, video_options, audio_options, format) {
		this.ffmpeg.addInput(file);

		if ( format ) {
			this.ffmpeg.inputFormat(format);
		}

		if (video_options) {
			this.streams.video.push( this.addTrack( file, 'v', video_options ) );
		}
		
		if (audio_options) {
			this.streams.audio.push( this.addTrack( file, 'a', audio_options ) );
		}

		this.input_index++;
	},

	addTrack: function( file, type, options ) {
		if( !options ){
			options = [];
		}

		var input_index = this.input_index;
		
		return {
			filename : file,
			name : type + "" + input_index,
			input_index : input_index,
			options: options
		};
	},

	setOption: function ( option, value) {
		this.options[option] = value;
	},

	streamNameToString: function ( stream_name ) {
		return "[" + stream_name + "]";
	},

	addFilter: function ( filter ) {
		this.complex_filters.push( filter );
	},

	incrementAudioStreamName: function() {
		this.streams.last_audio_name = "a" + ( parseInt(this.streams.last_audio_name.replace("a", "")) + 1 );
	},

	decrementAudioStreamName: function() {
		this.streams.last_audio_name = "a" + ( parseInt(this.streams.last_audio_name.replace("a", "")) - 1 );
	},
};

function isEmpty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }

    return true;
}