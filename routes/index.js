var express = require('express');
var router = express.Router();
var path = require('path');
var appDir = path.dirname(require.main.filename);
var mustacheExpress = require('mustache-express');
var fs = require('file-system');
var editor = require(path.join(appDir, '/editor.js'));
var bodyParser = require('body-parser');
var passport = require('passport');
var User = require("../models/user");
var Media = require("../models/media");
var ffmpeg = require('fluent-ffmpeg');

/* GET home page. */
router.get('/', function(req, res) {
	if ( !req.user ) {
		return res.redirect('/login');
	}

	Media.find({}, function (err, medias) {
		var visible_medias = [];
		for ( var i = 0; i < medias.length; i++ ) {
			
			if (medias[i].type == 'audio') {
				medias[i].thumbnail = 'images/audio-thumb.png';
			}
			else if (medias[i].type == 'image') {
				medias[i].thumbnail = medias[i].filepath.replace('public', '');
			}

			if ( fs.existsSync(medias[i].filepath) ){ 
				medias[i].filepath = medias[i].filepath.replace( 'public/', '' );
				visible_medias.push(medias[i]);
			}
		}

		res.render('editor.html', {
			medias: visible_medias
		});
	});;

});

router.post('/editor', function(req, res) {
	if (req.user) {
		if ( !req.body.render_options || !req.body.render_options.format ) {
			var format = 'webm';
		}
		else {
			var format = req.body.render_options.format;
		}
	  	
	  	var filename = "";
	    var possible_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	    for( var i=0; i < 10; i++ ) {
	        filename += possible_chars.charAt(Math.floor(Math.random() * possible_chars.length));
	    }

		var filepath = path.join('media/' + req.user._id, '/' + filename + '.' + format);

		var data = editor.render(req.session.editor_state, req.body.render_options).on('progress', function(progress) {
			req.app.io.emit('render-progress', progress);
		})
		.on('end', function() {
			req.app.io.emit('render-complete', filepath);	
		})
		.save( path.join(__dirname, '../public/media/' + req.user._id, '/' + filename + '.' + format) );
		res.send("1");
	}
	else {
		res.send("0");
	}
});

router.get('/login', function(req, res){
	res.render('login.html', { success_messages: req.flash('success_messages'), error_messages: req.flash('error_messages') });
});

router.post('/delete-media', function(req, res){
	if ( req.user ) {
		Media.find({ _id: req.body.id }, function (err, medias) {
			if ( medias.length ) {
				for ( var i = 0; i < medias.length; i++ ) {
					var media = medias[i];
					if ( media.owner == req.user._id ) {
						media.remove( function (err) {
							if (err) {
								console.log(err);
								res.send('0');
							}
							res.send('1');
						});
					}
					else {
						res.send('0');
					}
				}
			}
			else {
				res.send('0');
			}
		});
	}
	else {
		res.send('0');
	}
});

router.post('/login', passport.authenticate( 'local', { successRedirect: '/', failureRedirect: '/login' } ));

router.post('/register', function (req, res) {

    if ( !User.validateEmail(req.body.email) ) {
        req.flash('error_messages', 'Invalid email');
		return res.redirect('/login');
    }

    if ( !User.validatePassword(req.body.password) ) {
        req.flash('error_messages', 'The password has to be at least 6 symbols long');
		return res.redirect('/login');
    }

    var new_user = new User({ email: req.body.email});
    new_user.password = new_user.generateHash(req.body.password);

    new_user.save(function (err, user) {
        if (err) console.error(err);
    }).then(function( user ){
		passport.authenticate('local', function(err, user) {
		    if (err || !user) {
				return res.redirect('/login');
		 	}
	    	req.logIn(user, function(err) {
				if (err) {
					console.log(err);
					return res.redirect('/login'); 
				}
				return res.redirect('/');
			});
		})(req, user);
    });

});

router.post('/upload', function(req, res) {
	var complete = function(err, file) {
		if ( req.user ) {

			var serverPath = file.filename;
			var path = file.file;

			var legit_video_mimes = [
				'video/mp4',				// .mp4
				'video/quicktime',			// .mov
				'video/x-msvideo',			// .avi
				'video/x-ms-wmv'			// .wmv
			];

			var legit_audio_mimes = [		
				'audio/mpeg',				// mp3			
				'audio/mp3',				// mp3			
				'audio/mp4',				// mp4 audio	
				'audio/ogg',				// Ogg Vorbis	
				'audio/vnd.wav'				// wav			
			];

			var legit_image_mimes = [
				'image/jpeg',
				'image/png',
				'image/bmp',
			];

			var file_type = false;
			var hasvideo = false;
			var hasaudio = false;
			if ( file.mimetype ) {
				if ( legit_video_mimes.indexOf(file.mimetype) != -1 ) {
					file_type = "video";
					hasaudio = true;
					hasvideo = true;
				}
				if ( legit_audio_mimes.indexOf(file.mimetype) != -1 ) {
					file_type = "audio";
					hasaudio = true;
				}
				if ( legit_image_mimes.indexOf(file.mimetype) != -1 ) {
					file_type = "image";
					hasvideo = true;
				}
			}

			if ( !err && file_type !== false ) {
				var new_media = new Media({
					title: serverPath,
					filepath: path.replace('public',''),
					filename: path.replace(/^.*[\\\/]/, ''),
					owner: req.user._id,
					type: file_type,
					hasvideo: hasvideo,
					hasaudio: hasaudio
				});

				new_media.save(function(err, newMedia) {
					if (err){
						console.log(err);
					}
					//create a thumbnail

					var command = ffmpeg(path)
					.ffprobe(function(err, data){
						if(err){
							console.log(err);
						}
						var split_filepath = data.format.filename.split('\\');
						split_filepath.pop();
						var folder = newMedia.getDirPath(true);
						
						var duration = data.format.duration;

						if (!fs.existsSync(folder)){
						    fs.mkdirSync(folder);
						}

						var new_filepath = folder + newMedia.filepath.replace(/^.*[\\\/]/, '').replace(/\s/g, '-');

						Media.update({ _id: newMedia.id }, {
							$set: { 
								metadata: data,
								filepath: new_filepath
							}
						}, function(err, data){
							if(err){
								console.log(err);
							}
							fs.renameSync(path, new_filepath);

							if ( newMedia.type != 'audio' ) {
								(function(newMedia, folder){
									var screenshot_command = ffmpeg(new_filepath);
									screenshot_command
									.on('error', function(err){
										console.log(err);
									})
									.screenshots({
										count: 1,
										timestamps: [duration / 2],
										filename: 'thumb.jpg',
										folder: folder,
										size: '320x240',
									}).on('end', function() {
										
										
										Media.update({ _id: newMedia.id }, { 
											$set: { 
												thumbnail: newMedia.getDirPath( false ) + 'thumb.jpg'
											}
										}, function(err, data){
											if(err){
												console.log(err);
											}
											console.log('Processing finished!');
											req.app.io.emit('refresh');
										});
									});
								})(newMedia, folder);
							}						
						});
					});
				});

			} else {
		  		console.log(err);
			}
		}
	}

	if ( !req.files.files.length ) {
		req.files.files = [req.files.files];
	}

	for ( var i=0; i<req.files.files.length; i++ ) {

		var file = req.files.files[i];
		(function(file){
			var read = fs.createReadStream(file.file);

			read.on('error', function(err) {
				complete(err, file);
			});

			var write = fs.createWriteStream(file.filename);
			write.on('error', function(err) {
				complete(err, file);
			});

			write.on('close', function(err) {
				complete(err, file);
			});

			read.pipe(write);
		})(file);
	}
	res.redirect('/');
});	

router.get('/preview', function(req, res) {
	res.contentType('webm');
	var data = req.session.editor_state;
	if( data && req.user ){
		if( req.app.ffmpeg_commands[req.user._id] ) {
			req.app.ffmpeg_commands[req.user._id].kill();
			req.app.ffmpeg_commands[req.user._id] = false;
		}

		var ffmpeg_preview = editor.render(data).format('webm');

		var start = req.param("preview_start");
		if ( start && !isNaN(parseFloat(start)) && isFinite(start) ) {
			ffmpeg_preview.seekOutput(start);
		}

		req.app.ffmpeg_commands[req.user._id] = ffmpeg_preview;

		return ffmpeg_preview.pipe(res, {end:true});    
	}
	else {
		console.log('No editor state');
		return;
	}

});

module.exports = router;

