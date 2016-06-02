var express = require('express');
var router = express.Router();
var path = require('path');
var appDir = path.dirname(require.main.filename);
var mustacheExpress = require('mustache-express');
var fs = require('file-system');
var editor = require(path.join(appDir, '/editor.js'));
var bodyParser = require('body-parser')

/* GET home page. */
router.get('/', function(req, res) {
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
		res.render('temp-api-interface.html', {
			videos: videos
		});
	});
});

router.post('/editor', function(req, res) {
	var data = editor.render(req.body);
	res.send(data);
});

module.exports = router;
