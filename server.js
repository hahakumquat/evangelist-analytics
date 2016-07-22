var express = require('express');
var mongoose = require('mongoose');
var app = express();

app.get('/', function (req, res) {
    res.sendFile('/public/index.html');
});

mongoose = require('mongoose');
var uri = process.env.MongoLabURI;
var db = mongoose.connect(uri);
var schema = mongoose.Schema;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
    console.log("db up")
    var userSchema = new Schema({
        name  :  { type: String, default: '' }
        , password   :  { type: String, default: '' }
    });
    var userModel = mongoose.model('User', userSchema);
    var test = new userModel({name: "test", password: "test"})

    console.log("me: " + test)

    test.save(function (err, test) {
        console.log("saved?")
        if (err) {
            console.log("error");
            return console.error(err);
        }
        console.log("saved!")
    });

    console.log("after save");

});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});
