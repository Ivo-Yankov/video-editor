var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mustacheExpress = require('mustache-express');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();
var http = require('http').Server(app);

// view engine setup
app.engine('html', mustacheExpress());
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, '/views'));


// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(cookieParser());
app.use("/public", express.static(__dirname + '/public'));
app.use('/users', users);
app.use('/', routes);

app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(r.route.path)
  }
})

module.exports = app;
  
http.listen(3000, function(){
  console.log('listening on *:3000');
});