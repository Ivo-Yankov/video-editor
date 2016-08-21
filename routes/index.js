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
var Video = require("../models/video");
var ffmpeg = require('fluent-ffmpeg');

/* GET home page. */
router.get('/', function(req, res) {
	console.log("exists?: " + fs.existsSync("/public/videos/57b82fe5c61e57e81eb7abba/57b9c3b35a672ce422822534/") );
	if ( !req.user ) {
		return res.redirect('/login');
	}

	var videos = [];

	fs.readdir('public/videos', function(err, files){
		if ( err ) {
            console.log("Error reading files: ", err);
        } 
        else {
        	files.forEach(function(file){
        		videos.push({name: file});
        	});
        }
		res.render('editor.html', {
			videos: videos
		});
	});
});

router.post('/editor', function(req, res) {
	var data = editor.render(req.body);
	res.send(data);
});

router.get('/login', function(req, res){
	res.render('login.html', { success_messages: req.flash('success_messages'), error_messages: req.flash('error_messages') });
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
				console.log(err); 
				console.log(user); 
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
		var serverPath = file.filename;
		var path = file.file;

		if (!err) {
			var new_video = new Video({
				title: serverPath,
				filename: path.replace('public',''),
				owner: req.user._id
			});

			new_video.save(function(err, newVideo) {
				if (err){
					console.log(err);
				}
				//create a thumbnail

				var command = ffmpeg(path)
				.ffprobe(function(err, data){
					if(err){
						console.log(err);
					}
					var split_filename = data.format.filename.split('\\');
					split_filename.pop();
					var folder = newVideo.getDirPath(true);
					var screenshot_command = ffmpeg(path);
					var duration = data.format.duration;

					if (!fs.existsSync(folder)){
					    fs.mkdirSync(folder);
					}

					(function(metadata, newVideo, folder){
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
							console.log('Processing finished!');
							
							var new_filename = folder + newVideo.filename.replace(/^.*[\\\/]/, '');

							Video.update({ _id: newVideo.id }, { 
								$set: { 
									metadata: metadata,
									filename: new_filename,
									thumbnail: folder + '/thumb.jpg'
								}
							}, function(err, data){
								if(err){
									console.log(err);
								}
								fs.renameSync(path, new_filename);
							});
						});
					})(data, newVideo, folder);
				});
			});

		} else {
	  		console.log(err);
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

module.exports = router;
