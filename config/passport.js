var LocalStrategy  = require('passport-local').Strategy;
var BearerStrategy = require('passport-http-bearer').Strategy;
const fs           = require("fs");
const jwt          = require('jsonwebtoken');
// var cert           = fs.readFileSync('private.key', 'utf8');
var models         = require('../models');
const { Op }       = require("sequelize");

module.exports = function (passport) {
    passport.use(new LocalStrategy({
        usernameField: 'account', passwordField: 'password', passReqToCallback: true,
    }, function (req, email, password, done) {

        models.User.findOne({ where: { email: email } }).then(async function (user) {
            if (!user) {
                return done(null, false, { message: '아이디를 확인해주세요' });
            }
            const admin = await db.User.findOne({ where: { email: email } });
            if (!admin.validPassword(password)) {
                return done(null, false, { message: '비밀번호를 확인해주세요.' });
            }
            admin.last_login = new Date();
            admin.save();
            return done(null, user);
        }).catch(function (err) {
            console.log(err);
            return done(err);
        });
    }));

    passport.serializeUser(function (user, done) {
        done(null, user.id);
    } );

    passport.deserializeUser(function (id, done) {
        models.User.findOne({ where: { id: id } }).then(function (user) {
            done(null, user);
        }).catch(function (err) {
            done(err);
        });
    } );

    passport.use(new BearerStrategy((token, done) => {
        jwt.verify(token, process.env.secret, (err, decoded) => {
            // decoded undefined
            if (err) return done(err);
            // console.log("decoded", decoded);
            models.Account.findOne({
                where: { account: decoded.account }
            }).then(user => {
                if (!user) return done(null, false);
                return done(null, user, { scope: 'all' });
            }).catch(err => {
                // console.log(err);
                return done(err);
            });
        });
    }));

};
