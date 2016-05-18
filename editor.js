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
		console.log(data);

		this.init();

		var duration = 40;

		this.addInput('color=black:s=1280x720', {
			declaration: [ 'setpts=PTS+0/TB', 'scale=1280x720', 'trim=start=0:end=' + duration ],
			overlay: [ 'overlay=shortest=1' ]
		}, {}, 'lavfi');

		this.addInput(
			path.join(__dirname, '/public/videos', '/video1.mp4'), 
			{
				declaration: [ 'setpts=PTS+0/TB', 'scale=1280x720', 'trim=start=0:end=30' ],
				overlay: [ 'overlay=eof_action=pass' ]
			},
			{
				start: 0,
				end: 30,
				offset: 0,
				filters: ['atrim=0:30'],
			}
		);

		this.addInput(
			path.join(__dirname, '/public/videos', '/cena.mp4'),
			{
				declaration: [ 'setpts=PTS+0/TB', 'scale=300x300', 'trim=start=10:end=20' ],
				overlay: [ 'overlay=eof_action=pass:x=100:main_w-overlay_w-50:main_h-overlay_h-50' ]
			},
			{
				start: 10,
				end: 20,
				offset: 0,
				filters: ['atrim=10:20']
			}
		);

		this.addInput(
			path.join(__dirname, '/public/videos', '/cena.mp4'),
			{
				declaration: [ 'setpts=PTS+0/TB', 'scale=500x500', 'trim=start=25:end=35' ],
				overlay: [ 'overlay=eof_action=pass:x=500:main_w-overlay_w-500:main_h-overlay_h-75' ]
			},
			{
				start: 25,
				end: 35,
				offset: -25,
				filters: ['atrim=25:35']
			}
		);


		this.addInput(
			path.join(__dirname, '/public/videos', '/cena.mp4'),
			{
				declaration: [ 'setpts=PTS+0/TB', 'scale=1280x720', 'trim=start=34:end=40' ],
				overlay: [ 'overlay=eof_action=pass' ]
			},
			{
				start: 34,
				end: 40,
				offset: 0,
				filters: ['atrim=34:40']
			}
		);		

		//Create base video stream and set resolution
		var baseFilter = 'nullsrc='; 
		baseFilter += 'size=' + this.options.resolution;
		// var endFilter = baseFilter;

		baseFilter += this.streamNameToString( this.streams.last_video_name );
		// endFilter += this.streamNameToString( 'endvideo' );

		this.addFilter( baseFilter );
		// this.addFilter( endFilter );

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



		// //end overlay
		// var end_overlay = this.streamNameToString( this.streams.last_video_name )
		// var end_overlay_name = "o" + overlay_index;

		// overlay_index++;

		// end_overlay += this.streamNameToString( 'endvideo' );
		// end_overlay += "overlay=shortest=1";
		// end_overlay += this.streamNameToString( end_overlay_name );
		
		// this.streams.last_video_name = end_overlay_name;
		// this.addFilter( end_overlay );

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
				if ( stream.options.start ) {
					filter = 'aevalsrc=0:d=' + stream.options.start + this.streamNameToString( this.streams.last_audio_name );
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

				concat_filter_end = "";
				if ( stream.options.end < duration ) {
					var end_silence_duration = duration - stream.options.end;
					filter = 'aevalsrc=0:d=' + end_silence_duration + this.streamNameToString( this.streams.last_audio_name );
					this.addFilter( filter );

					concat_filter_end = this.streamNameToString( this.streams.last_audio_name );

					this.incrementAudioStreamName();	
					concat_count++;			
				}

				if ( concat_filter_start || concat_filter_end ) {
					var concat_filter = concat_filter_start + audio_stream_name + concat_filter_end;
					concat_filter += "concat=n=" + concat_count + ":v=0:a=1";
					this.incrementAudioStreamName();
					concat_filter += this.streamNameToString( this.streams.last_audio_name );
					this.addFilter( concat_filter );
				}

				amix_count++;
				amix_filter += this.streamNameToString( this.streams.last_audio_name );
				this.incrementAudioStreamName();
			}
		}

		if ( amix_count > 1 ) {
			amix_filter += "amix=inputs=" + amix_count + this.streamNameToString( this.streams.last_audio_name );
			this.addFilter( amix_filter );
		}



		// this.ffmpeg.complexFilter([

		// 	// base
		// 	'nullsrc=size=1280x720 [base]',

		// 	// video
		// 	'[0:v]setpts=PTS-STARTPTS,scale=1280x720,trim=start=0:end=30[v1]',
		// 	'[1:v]setpts=PTS+0/TB,scale=300x300,trim=start=10:end=20[v2]',
		// 	'[base][v1]overlay=shortest=1[base+v1]',
		// 	'[base+v1][v2]overlay=eof_action=pass:x=100:main_w-overlay_w-50:main_h-overlay_h-50',
			
		// 	// audio
		// 	'[0:a]atrim=0:30[a3]',
		// 	'aevalsrc=0:d=10[a1]',
		// 	'[1:a]atrim=10:20[a11]',
		// 	'[a1][a11]concat=n=2:v=0:a=1[a2]',
		// 	'[a3][a2]amix=inputs=2'
		// ]);

		this.ffmpeg.complexFilter(this.complex_filters);

		this.ffmpeg.addOption('-map', this.streamNameToString( this.streams.last_video_name ) );
		this.ffmpeg.addOption('-map', this.streamNameToString( this.streams.last_audio_name ) );
		this.ffmpeg.addOption('-t', duration );

		this.ffmpeg.save(path.join(__dirname, '/public/videos', '/test-mest-1.mp4'));
		return true;
	},

	init: function () {
		this.ffmpeg = ffmpeg();

		this.ffmpeg.on('progress', function(progress) {
			if(parseInt(progress.percent) % 5 == 0){
				console.log('Processing: ' + progress.percent + '% done');
			}
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

		//todo
		this.setOption('resolution', '1280x720');
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
	}
};

function isEmpty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }

    return true;
}