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

	render: function (data) {
		console.log(data);

		this.init();

		this.addInput(
			path.join(__dirname, '/public/videos', '/video1.mp4'), 
			{
				declaration: [ 'setpts=PTS-STARTPTS', 'scale=1280x720', 'trim=start=0:end=30' ],
				overlay: [ 'overlay=shortest=1' ]
			},
			{
				start: 0,
				filters: ['atrim=0:30'],
			});

		this.addInput(
			path.join(__dirname, '/public/videos', '/cena.mp4'),
			{
				declaration: [ 'setpts=PTS+0/TB', 'scale=300x300', 'trim=start=10:end=20' ],
				overlay: [ 'overlay=eof_action=pass:x=100:main_w-overlay_w-50:main_h-overlay_h-50' ]
			},
			{
				start: 10,
				filters: ['atrim=10:20']
			}
		);

		//Create base video stream; set its resolution
		this.addFilter( 'nullsrc=size=' + this.options.resolution + this.streamNameToString( this.streams.last_video_name ) );

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
			concat_filter = "";
			var stream = this.streams.audio[i];
			if ( stream.options.start ) {
				// 'aevalsrc=0:d=10[a1]',
				// '[a1][a11]concat=n=2:v=0:a=1[a2]',
				filter = 'aevalsrc=0:d=' + stream.options.start + this.streamNameToString( this.streams.last_audio_name );
				this.addFilter( filter );

				concat_filter = this.streamNameToString( this.streams.last_audio_name );

				//increment the stream name
				this.incrementAudioStreamName();
			}

			filter = this.streamNameToString( stream.name );
			filter += stream.options.filters.join(',');
			filter += this.streamNameToString( this.streams.last_audio_name );
			this.addFilter( filter );
			// 	'[1:a]atrim=10:20[a11]',

			if ( concat_filter ) {
				concat_filter += this.streamNameToString( this.streams.last_audio_name );
				concat_filter += "concat=n=2:v=0:a=1";
				this.incrementAudioStreamName();
				concat_filter += this.streamNameToString( this.streams.last_audio_name );
				this.addFilter( concat_filter );
			}

			amix_count++;
			amix_filter += this.streamNameToString( this.streams.last_audio_name );
			this.incrementAudioStreamName();
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

		this.ffmpeg.save(path.join(__dirname, '/public/videos', '/test-mest.mp4'));

		/*
		var file = path.join(__dirname, '/public/videos', '/video1.mp4');

		this.addVideoTrack(file, [
			'-t 10'
		])
		this.ffmpeg.seekInput(50);
		this.addVideoTrack(file, [
			'-t 20'
		]);

		// this.setOutput("test-1.mp4");
		// this.ffmpeg.run();

		this.ffmpeg.mergeToFile("merged.mp4", path.join(__dirname, '/temp'));

		//Create the ffmpeg object
		// this.init();
		// this.addVideoTrack('');
		// this.output('test.mp4').run();

		*/
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

	addInput: function(file, video_options, audio_options) {
		this.ffmpeg.addInput(file);
		this.streams.video.push( this.addTrack( file, 'v', video_options ) );
		this.streams.audio.push( this.addTrack( file, 'a', audio_options ) );
	},

	addTrack: function( file, type, options ) {
		if( !options ){
			options = [];
		}

		//TODO fix the input index
		var input_index = this.streams.video.length + this.streams.audio.length;

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