const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

// passport is a package used for authentication
// that allows you to choose a 'strategy' to login.
// 'local' is a strategy that ensures email & passwords match
// there are other strategies; for facebook to check for tokens, etc
// http://www.passportjs.org/docs/ for the docs & strategies
exports.login = passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Failed Login!',
    successRedirect: '/',
    successFlash: 'You are now logged in!'
});

exports.logout = (req, res) => {
    req.logout();
    req.flash('success', 'You are now logged out!');
    res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
    // 1st check if user is authenticated
    if(req.isAuthenticated()) {
        next(); // carry on because they are logged in
        return;
    }
    req.flash('error', 'Oops! Must be logged in to do that!');
    res.redirect('/login');
};

exports.forgot = async (req, res) => {
    // 1. see if user exists
    const user = await User.findOne({email: req.body.email})
    if (!user) {
        req.flash('error', 'A password reset has been mailed to you.');
        return res.redirect('/login');
    }
    // 2. set / reset tokens and expiry on their account
    user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now = 3600000
    await user.save();
    // 3. send them an email with the token
    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
    await mail.send({
        user,
        subject: 'Password Reset',
        resetURL,
        filename: 'password-reset',

    })
    req.flash('success', `You have been emailed a password reset link.`);
    // 4. redirect to login page
    res.redirect('/login');
};

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now()} 
    });

    if (!user) {
        await req.flash('error', 'Password reset is invalid or has expired.');
        return res.redirect('/login');
    }

    // if there is a user, show the reset password form
    res.render('reset', { title: 'Reset your password'});
};

exports.confirmedPasswords = (req, res, next) => {
    if (req.body.password === req.body['password-confirm']) {
        next(); // keep it going
        return; // kill this function
    }
    req.flash('error', 'Passwords do not match');
    res.redirect('back');
};

exports.update = async (req, res) => {
    const user = await User.findOne({
			resetPasswordToken: req.params.token,
			resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
			await req.flash('error', 'Password reset is invalid or has expired.');
			return res.redirect('/login');
    }
    
    const setPassword = promisify(user.setPassword, user);
    await setPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    const updatedUser = await user.save();
    await req.login(updatedUser);
    await req.flash('success', 'Nice! Your password has been reset! You are now logged in.');
    res.redirect('/');
};