var naytradingClient = require('../clients/naytrading_client');
var naytradingStore = require('../stores/naytrading_store');

module.exports = function (passport) {

    var LocalStrategy = require('passport-local').Strategy;

    passport.use('local-signin', new LocalStrategy(
        {
            // by default, local strategy uses username and password, we will override with email
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true // allows us to pass back the entire request to the callback
        },

        function (req, email, password, done) {

            naytradingClient.login(email, password).then(function (jar) {

                if (!jar.naytradingUser) {

                    return done(null, false, {
                        hasError: true,
                        message: 'This combination of email and password does not exist.'
                    });

                }

                naytradingStore.setPassword(email, password);

                var userinfo = {
                    email: email
                };
                return done(null, userinfo);

            }).catch(function (err) {

                console.log("Error:" + err.message + "\n" + err.stack);

                return done(null, false, {
                    hasError: true,
                    message: 'Error while signing in: ' + err.message
                });

            });

        }
    ));

    //serialize
    passport.serializeUser(function (user, done) {

        done(null, user.email);

    });

    // deserialize user 
    passport.deserializeUser(async function (email, done) {

        try {
            await naytradingStore.login((password) => {
                done(null, { email: email });
            }, email);
        }
        catch (error) {
            done(null, null);
        }

    });
}