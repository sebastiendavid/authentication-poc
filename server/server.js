'use strict';
var _ = require('lodash');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var express = require('express');
var fs = require('fs');
var http = require('http');
var LocalStrategy = require('passport-local').Strategy;
var morgan = require('morgan');
var passport = require('passport');
var path = require('path');
var serveStatic = require('serve-static');
var session = require('express-session');
var uuid = require('node-uuid');

module.exports = function () {
    var app;
    var server;
    var users;

    app = express()
        .use(morgan('dev'))
        .use(cookieParser())
        .use(bodyParser.urlencoded({
            extended: false
        }))
        .use(session({
            genid: function () {
                return uuid.v4();
            },
            secret: uuid.v4(),
            resave: true,
            saveUninitialized: true
        }))
        .use(passport.initialize())
        .use(passport.session())
        .engine('html', function (filePath, options, callback) {
            fs.readFile(filePath, function (err, content) {
                if (err) {
                    return callback(new Error(err));
                }
                return callback(null, _.template(content)(options));
            });
        })
        .set('views', path.join(__dirname, 'views'))
        .set('view engine', 'html');

    users = [{
        id: uuid.v4(),
        username: 'foo',
        password: 'bar'
    }];

    passport.use(new LocalStrategy(function (username, password, done) {
        var user = _.find(users, {
            username: username
        });
        if (!user) {
            return done(null, false, {
                message: 'Incorrect username.'
            });
        }
        if (password !== user.password) {
            return done(null, false, {
                message: 'Incorrect password.'
            });
        }
        return done(null, user);
    }));

    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function (id, done) {
        var user = _.find(users, {
            id: id
        });
        done(user ? undefined : new Error('user not found'), user);
    });

    app.post('/signin', function (req, res, next) {
        passport.authenticate('local', function (err, user) {
            if (err || !user) {
                return res.type('html').status(401).render('error.html', {
                    message: 'Invalid credentials'
                });
            } else if (user) {
                req.logIn(user, function (err) {
                    if (err) {
                        return res.type('html').status(500).render('error.html', {
                            message: err.message
                        });
                    }
                    return res.redirect('/protected/home.html');
                });
            }
        })(req, res, next);
    });

    app.get('/signout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/unauthorized.html', function (req, res) {
        res.type('html').status(401).render('error.html', {
            message: 'Unauthorized'
        });
    });

    app.all('/protected/*', function (req, res, next) {
        if (req.user) {
            next();
        } else {
            res.redirect('/unauthorized.html');
        }
    });

    app.use(serveStatic(path.join(__dirname, '..', 'bower_components')));
    app.use(serveStatic(path.join(__dirname, 'public')));
    server = http.createServer(app).listen(8000);
    console.info('http://localhost:8000');

    return {
        app: app,
        server: server
    };
};
