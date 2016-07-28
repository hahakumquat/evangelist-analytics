/**************************************************************************
 * Starts server: pulls environment files from .env,
 * connects to mongoose database, pulls data, and
 * listens for page request
*************************************************************************/

var express = require('express');
var mongoose = require('mongoose');
var path = require("path");
var env = require('node-env-file');
env(__dirname + '/.env');

mongoose.connect(process.env.MongoLabURI, function (error) {
    if (error) {
        console.log(error);
    }
});

var userSchema = require("mongooseSchema");
var User = mongoose.model('users', userSchema);

var app = express();
app.use(express.static(__dirname + "/public"));

app.get('/data', function (req, res) {
    User.find({}, function (err, data) {
        if (err)
            console.log(err);
        else
            res.send(data);
    });
});

app.listen(3000);
