var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const passport     = require('passport');
const passportConf = require('./config/passport');
const session = require('express-session');
const cors         = require('cors')
const glob         = require('glob');

var app = express();

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret              : process.env.secret,
  resave              : true, cookie: {
    secure: false, maxAge: 1000 * 60 * 60 * 24,
  }, saveUninitialized: false
}))

app.use(passport.initialize()); // passport 구동
app.use(passport.session()); // 세션 연결
passportConf(passport); // passport 설정 적용

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.all(/^(?!\/auth*)(?!\/uploads*)(?!\/sdk*)(?!\/api*).*$/m, passport.authenticate("bearer", { session: false }), function (req, res, next) {
  return next();
  if (req.url.indexOf('/auth') > -1 || req.url.indexOf('/sdk') > -1 || req.url.indexOf('/uploads') > -1 || req.url.indexOf('/api/manual') > -1) {
    next();
  } else {
    if (req.user) {
      next();
    } else {
      console.log("need login")
    }
  }
});

const routes = glob.sync(__dirname + '/routes/*.js');
routes.forEach(function (route) {
  var extension = path.extname(route);
  var file      = path.basename(route, extension);
  var router    = require('./routes/' + file);

  if (file == 'index') {
    app.use('/', router)
  } else {
    app.use('/' + file, router)
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send('error');
});

module.exports = app;
