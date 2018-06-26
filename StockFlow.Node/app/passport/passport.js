//load bcrypt
var bCrypt = require('bcrypt-nodejs');
var config = require('../config/envconfig');
var model = require('../models/index');


module.exports = function (passport, user) {

    var User = user;
    var LocalStrategy = require('passport-local').Strategy;

    function isValidPasswordFormat(password) {
        if (typeof (password) === 'string') {
            return password.length >= 8 && password.length <= 200;
        }
        return false;
    }

    passport.use('local-signup', new LocalStrategy(
        {
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true // allows us to pass back the entire request to the callback
        },

        function (req, email, password, done) {

            var generateHash = function (password) {

                return bCrypt.hashSync(password, bCrypt.genSaltSync(8), null);

            };

            User.findOne({
                where: {
                    email: email
                }
            }).then(function (user) {

                if (user) {

                    return done(null, false, {
                        hasError: true,
                        message: 'That email is already taken'
                    });

                } else {

                    model.whitelist.findOne({
                        where: {
                            email: email
                        }
                    }).then(function (whitelist) {

                        if (config.whitelist && email != config.admin_user && whitelist == null) {
                            return done(null, false, {
                                hasError: true,
                                message: 'That email is not on the whitelist'
                            });
                        }

                        if (password != req.body.confirmPassword) {

                            return done(null, false, {
                                hasError: true,
                                message: 'Password not confirmed correctly'
                            });

                        }

                        if (!isValidPasswordFormat(password)) {

                            return done(null, false, {
                                hasError: true,
                                message: 'Password must be between 8 and 200 characters'
                            });

                        }

                        var userPassword = generateHash(password);

                        var data =
                            {
                                email: email,

                                password: userPassword

                            };

                        User.create(data).then(function (newUser, created) {

                            if (!newUser) {

                                return done(null, false);

                            }

                            if (newUser) {

                                return done(null, newUser);

                            }

                        });

                    })

                }

            });

        }

    ));

    passport.use('local-signin', new LocalStrategy(
        {
            // by default, local strategy uses username and password, we will override with email
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true // allows us to pass back the entire request to the callback
        },

        function (req, email, password, done) {

            var User = user;

            var isValidPassword = function (userpass, password) {

                return bCrypt.compareSync(password, userpass);

            }

            User.findOne({
                where: {
                    email: email
                }
            }).then(function (user) {

                if (!user) {

                    return done(null, false, {
                        hasError: true,
                        message: 'Email does not exist'
                    });

                }

                if (!isValidPassword(user.password, password)) {

                    return done(null, false, {
                        hasError: true,
                        message: 'Incorrect password.'
                    });

                }

                var userinfo = user.get();
                return done(null, userinfo);

            }).catch(function (err) {

                console.log("Error:", err);

                return done(null, false, {
                    hasError: true,
                    message: 'Something went wrong with your Signin'
                });

            });

        }
    ));

    passport.use('local-change', new LocalStrategy(
        {
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true // allows us to pass back the entire request to the callback
        },

        function (req, email, password, done) {

            var generateHash = function (password) {

                return bCrypt.hashSync(password, bCrypt.genSaltSync(8), null);

            };

            var isValidPassword = function (userpass, password) {

                return bCrypt.compareSync(password, userpass);

            }

            if (email != req.user.email) {
                return done(null, false, {
                    hasError: true,
                    message: 'Trying to change the password of a different user'
                });
            }

            User.findOne({
                where: {
                    email: req.user.email
                }
            }).then(function (user) {

                if (!user) {

                    return done(null, false, {
                        hasError: true,
                        message: 'User does not exist'
                    });

                }

                if (!isValidPassword(user.password, password)) {

                    return done(null, false, {
                        hasError: true,
                        message: 'Incorrect password'
                    });

                }

                if (req.body.newPassword != req.body.confirmPassword) {

                    return done(null, false, {
                        hasError: true,
                        message: 'Password not confirmed correctly'
                    });

                }

                if (!isValidPasswordFormat(req.body.newPassword)) {

                    return done(null, false, {
                        hasError: true,
                        message: 'Password must be between 8 and 200 characters'
                    });

                }

                var userPassword = generateHash(req.body.newPassword);

                user.password = userPassword;

                user.save().then(function () {
                    var userinfo = user.get();
                    return done(null, userinfo, {
                        hasError: false,
                        message: 'Password changed'
                    });
                });

            }).catch(function (err) {

                console.log("Error:", err);

                return done(null, false, {
                    hasError: true,
                    message: 'Something went wrong'
                });

            });

        }
    ));

    //serialize
    passport.serializeUser(function (user, done) {

        done(null, user.id);

    });

    // deserialize user 
    passport.deserializeUser(function (id, done) {

        User.findById(id).then(function (user, error) {

            if (user) {

                done(null, user.get());

            } else {

                done(error, null);

            }

        });

    });
}