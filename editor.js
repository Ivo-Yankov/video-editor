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
		var resolution_width = "320";
		var resolution_height = "180";
		var resolution = resolution_width + "x" + resolution_height;
		var background = "black";
		var uploads_folder = '/public/';

		this.init();

		// Add base input
		this.addInput('color=' + background + ':s=' + resolution, {
			declaration: [ 'setpts=PTS+0/TB', 'scale=' + resolution ],
			overlay: [ 'overlay=shortest=1' ]
		}, {}, 'lavfi');

		var duration = 0;

		for( var i = 0; i < clips.length; i++ ) {
			var clip = clips[i];
			clip.end = Number(clip.end);
			clip.start = Number(clip.start);
			clip.timeline_start = Number(clip.timeline_start);

			var timeline_end = clip.end - clip.start + clip.timeline_start;
			if ( timeline_end > duration ) {
				duration = timeline_end;
			}

			var filepath =  path.join(__dirname, uploads_folder, clip.file);

			var video_options = {
				declaration: [],
				overlay : []
			};

			var audio_options = {
				start: clip.timeline_start,
				end: clip.timeline_start + clip.end,
				filters: []
			};

			var offset = clip.timeline_start - clip.start;
			if ( clip.has_video ) {
				// Create the video declaration step filters
 				video_options.declaration.push( 'setpts=PTS+' + offset + '/TB' );

	 			var width = clip.bottom_right_x - clip.top_left_x;
	 			var height = clip.bottom_right_y - clip.top_left_y;
	 			// if( width != resolution_width || height != resolution_height ) {
	 				video_options.declaration.push( 'scale=' + width + 'x' + height );
	 			// }

	 			video_options.declaration.push( 'trim=start=' + clip.start + ':end=' + (offset + clip.end) );

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

			if ( clip.has_audio ) {
				// Create the audio filters
 				audio_options.filters.push( 'asetpts=PTS+' + offset + '/TB' );

				audio_options.filters.push( 'atrim=start=' + (clip.start + offset) + ':end=' + (clip.end + offset) );

				if ( clip.volume || clip.volume === 0 ) {
					audio_options.filters.push( 'volume=' + clip.volume );
				}
			}

			// Add the input
			this.addInput(filepath, video_options, audio_options);
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
		var amix_filter = "";
		var amix_count = 0;

		for ( var i = 0; i < this.streams.audio.length; i++ ) {
			filter = "";
			
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
				this.incrementAudioStreamName();

				this.addFilter( filter );

				// Audio does not end at the end of the whole movie
				concat_filter_end = "";
				if ( stream.options.end < duration ) {
					var end_silence_duration = duration - stream.options.end;
					filter = 'aevalsrc=0:s=48000:d=' + end_silence_duration + this.streamNameToString( this.streams.last_audio_name );
					this.addFilter( filter );

					concat_filter_end = this.streamNameToString( this.streams.last_audio_name );

					this.incrementAudioStreamName();	
					concat_count++;			
				}

				if ( concat_filter_start || concat_filter_end ) {
					var concat_filter = concat_filter_start + audio_stream_name + concat_filter_end;
					concat_filter += "concat=n=" + concat_count + ":v=0:a=1";
					concat_filter += this.streamNameToString( this.streams.last_audio_name );
					this.addFilter( concat_filter );
				}

				amix_count++;
				amix_filter += this.streamNameToString( this.streams.last_audio_name );
				// this.incrementAudioStreamName();
			}
		}

		if ( amix_count > 1 ) {
			this.incrementAudioStreamName();
			amix_filter += "amerge=inputs=" + amix_count;
			amix_filter += this.streamNameToString( this.streams.last_audio_name );
			this.addFilter( amix_filter );
		}
		else if( !concat_filter_start && !concat_filter_end ) {
			this.decrementAudioStreamName();
		}

		this.ffmpeg.complexFilter(this.complex_filters);

		this.ffmpeg.addOption('-map', this.streamNameToString( this.streams.last_video_name ) );
		this.ffmpeg.addOption('-map', this.streamNameToString( this.streams.last_audio_name ) );
		this.ffmpeg.addOption('-t', duration );
		this.ffmpeg.addOption('-ac', amix_count );
		// this.ffmpeg.addOption('-c:a', 'libfdk_aac' );
		this.ffmpeg.addOption('-b:a', '48k' );

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

		this.streams.video.push( this.addTrack( file, 'v', video_options ) );
		this.streams.audio.push( this.addTrack( file, 'a', audio_options ) );
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

	decrementAudioStreamName: function( ) {
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