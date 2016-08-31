var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
var mustacheExpress = require('mustache-express');
var passport = require('passport');
var flash = require('connect-flash'); //TODO 
var routes = require('./routes/index');
var bb = require('express-busboy');
var session = require('express-session');
var sharedsession = require("express-socket.io-session");
var fs = require('fs');

var editor = require('./editor.js');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
app.io = io;

//database
var mongo = require('mongodb');
var mongoose = require('mongoose');
var configDB = require('./config/database.js');
mongoose.connect(configDB.url); // connect to our database


var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  // yay! 
});

var configPassport = require('./config/passport'); // pass passport for configuration
var sessionMiddleWare = session({ secret: 'keyboard cat', resave: true, saveUninitialized: true });

app.use(sessionMiddleWare);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

io.use(sharedsession(sessionMiddleWare));

app.use(function(req, res, next){
    res.locals.success_messages = req.flash('success_messages');
    res.locals.error_messages = req.flash('error_messages');
    next();
});

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

// view engine setup
app.engine('html', mustacheExpress());
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, '/views'));

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(__dirname + '/public'));

bb.extend(app, { upload: true, path: 'public/media' });

app.use('/', routes);

app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(r.route.path)
  }
})

module.exports = app;
  
io.on('connection', function(socket){
  socket.on('update_editor_state', function(editor_state){
    socket.handshake.session.editor_state = editor_state;
    socket.handshake.session.save();

    var data = socket.handshake.session.editor_state;
    if( data ){
      if( socket.ffmpeg_preview ) {
        socket.ffmpeg_preview.kill();
      }
    }
    else {
      console.log('No editor state');
    }    
  });

});

http.listen(3000, function(){
  console.log('listening on *:3000');
});