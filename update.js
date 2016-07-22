/**************************************************************************
 * Updates MongoDB with incoming data.
 * To be called on a regular basis with a cron job
 *************************************************************************/

var https = require("https");
var mongoose = require('mongoose');
var env = require('node-env-file');
env(__dirname + '/.env');

var key = process.env.Key;
var secret = process.env.Secret;

var user_ids = [
    "748625448771457025",
    "633344107",
    "44491207"
];

var userData = [
    "statuses_count",
    "followers_count",
    "friends_count",
    "listed_count",
    "id", "screen_name"
];

var statusData = [
    "id",
    "retweet_count",
    "favorite_count",
    "text"
];

var data = {}; // Data buffer
var completed = user_ids.length; // semaphore for data pull complete

main();

/***************************************************************************/
/****************************HTTPS REQUESTS*********************************/
/***************************************************************************/

// Starts data update by getting token and then updating data
function main() {
    getBearerToken(getPerUserData);
}

// Gets twitter request for bearer token, used for authenticating ALL reqs
function getBearerToken(callback) {
    requestTwitter({
        headers: {
            Authorization: "Basic " + getCredentials(key, secret),
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        method: "POST",
        path: "/oauth2/token"
    }, undefined, callback);
}

// Iterates through all people, calling each person's data query
function getPerUserData(token) {
    user_ids.forEach(function(id, i) {
        getUserTimeline(token, id);
    });
};

// Timeline data returns obj containing user and statuses (up to max 200) data
function getUserTimeline(token, id) {
    requestTwitter({
        headers: {
            Authorization: "Bearer " + token,
        },
        method: "GET",
        path: "/1.1/statuses/user_timeline.json?user_id=" + id + "&count=200"
    }, token, updateTimelineData);
};

// First fills user fields in data, then updates with all statuses
function updateTimelineData(_, obj) {
    updateUsers(obj[0].user);
    updateStatuses(obj);
    if (--completed == 0) {
        updateMongoDB();
    }
};

function updateUsers(user) {
    var i = user.id_str;
    data[i] = data[i] || {};
    userData.forEach(function(d) {
        data[i][d] = user[d];
    });
}

function updateStatuses(statuses) {
    var userid = statuses[0].user.id_str;
    data[userid].statuses = data[userid].statuses || [];
    data[userid].retweets = data[userid].retweets || [];
    Object.keys(statuses).forEach(function(i) {
        var tmp = {};
        var status = statuses[i];
        statusData.forEach(function(s) {
            tmp[s] = status[s];
        });
        // checks if retweet or status
        if (status["retweeted_status"])
            data[userid].retweets.push(tmp);
        else
            data[userid].statuses.push(tmp);
    });
}

// Makes a twitter request with input options,
// the token if available, and a function when the data is returned
function requestTwitter(options, token, func) {
    options.hostname = 'api.twitter.com';
    options.port = 443;

    var callback = function (res) {
        var resData = [] ;
        res.on('data', function(d) {
            resData.push(d);
        });
        res.on('error', function(err) {            
            console.log(err);
        });
        res.on('end', function() {
            var st = '';
            resData.forEach(function(fragment) {
                st += fragment.toString();
            }); 
            var obj = JSON.parse(st);
            token = token || obj.access_token;
            if (func !== undefined)
                func(token, obj);
        });
    };

    var req = https.request(options, callback);
    if (options.method === 'POST') {
        req.write("grant_type=client_credentials");
    }
    req.end();
}

function getCredentials(key, secret) {
    var c = key + ":" + secret;
    c = new Buffer(c).toString("base64");
    return c;
};

/***************************************************************************/
/****************************MONGO DB UPDATE********************************/
/***************************************************************************/

function updateMongoDB() {
    db = mongoose.createConnection(process.env.MongoLabURI);
    var db = mongoose.connection;
    var Schema = mongoose.Schema;
    
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {
        console.log("We're connected!");

        var userSchema = new Schema({
            // "id": Number,
            // "statuses_count": Number,
            // "followers_count": Number,
            // "friends_count": Number,
            // "listed_count": Number,
            // "screen_name": String,
            // "statuses": [{
            //     "id": Number,
            //     "retweet_count": Number,
            //     "favorite_count": Number,
            //     "text": String
            // }],
            // "retweets": [{
            //     "id": Number,
            //     "retweet_count": Number,
            //     "favorite_count": Number,
            //     "text": String
            // }],  
            name: String,
            password: String
        });
        var User = mongoose.model("User", userSchema);
        var test = new User({ name: "nam", password: "pass" });
        console.log("made test");
        test.save(function(err, test) {
            console.log("savedd?");
            if (err) {
                console.log("not saved, err");
                return console.error(err);
            }
            console.log("saved");
        });

        console.log("done");
    }); 
        // Object.keys(data).forEach(function(p) {
        //     var obj = data[p];
        //     var person = new User(obj);
            // connection.collection.insert(person);
            // person.save(function(err) {
            //     if (err) {
            //         return handleError(err);
            //     } else {
            //         console.log("Success!");
            //     }
            // });
    // });
}
