/**************************************************************************
* Updates MongoDB with incoming data.
* To be called on a regular basis with a cron job
*************************************************************************/
/*
  Issues:
  Duplicating tweets despite checking for date?
  Can't find tweets from more than 200 tweets before yet...
*/

var https = require("https");
var mongoose = require('mongoose');
var env = require('node-env-file');
env(__dirname + '/.env');

var key = process.env.Key;
var secret = process.env.Secret;

var user_ids = [
    "633344107", // Shiya
    "44491207",  // Jaime 
    "2520004602", // Cyrille
    "1058645280", // Stephen
    "3131076946", // Philippe
    "24024574", // Augusto
    "23085371", // Adam
    "4350680893", // Mikako
    "28485073", // Xiaodong
    "340596214", // Jim
];

/* Hierarchy:
object {
    statuses_count
    followers_count
    ...
    statuses: [
        id:
        retweet_count
        ...
    ]
} 
*/

// Specify the properties to collect from a user here
var userData = [
    "statuses_count",
    "followers_count",
    "friends_count",
    "listed_count",
    "id",
    "screen_name"
];

// Specify the properties to collect from a status here
var statusData = [
    "id",
    "retweet_count",
    "favorite_count",
    // "text"
    // created_at is calculated separately
];

var data = {}; // Data buffer of users' current states
var get200 = user_ids.length; // semaphore for 1st 200 data pull completion
var get3000 = {};
main();

/***************************************************************************/
/****************************HTTPS REQUESTS*********************************/
/***************************************************************************/

/* Starts data update by getting token and then updating data
Note: Twitter only allows 300 requests per 15 minutes.*/
function main() {
    getBearerToken(getPerUserData);
}

// Gets twitter request for bearer token, used for authenticating ALL reqs
function getBearerToken(callback) {
    console.log("Retrieving bearer token.");
    requestTwitter({
        headers: {
            Authorization: "Basic " + getCredentials(key, secret),
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        method: "POST",
        path: "/oauth2/token"
    }, undefined, function(token) {
        console.log("Token retrieved!");
        callback(token);
    });
}

/* Iterates through all people, calling each person's timeline query.
   Note: Twitter only allows 300 requests per 15 minutes with a
   max of 200 tweets per query. TODO: loop back in time by max_id
   to find groups of 200 */
function getPerUserData(token) {
    user_ids.forEach(function(id, i) {
        console.log("Requesting initial data from " + id + ".");
        getUserTimeline(token, id);
    });
};

// Timeline data returns obj containing user and statuses
// optional max_id provided which specifies the latest tweet to pull
function getUserTimeline(token, id, max_id) {
    var path = "/1.1/statuses/user_timeline.json?user_id=" + id + "&count=200";
    if (max_id)
        path += "&max_id=" + max_id;
    requestTwitter({
        headers: {
            Authorization: "Bearer " + token,
        },
        method: "GET",
        path: path
    }, token, function(token, obj) {
        console.log("Received data for " + obj[0].user.screen_name + ".");
        updateTimelineData(token, obj);
    })
};

// stores in data object. 
function updateTimelineData(token, obj) {
    // note that this call to updateUsers is repeated unnecessarily
    updateUsers(obj);
    updateStatuses(obj);

    // If all users' data retrieved for first 200, start off finding next 3000
    if (--get200 == 0) {
        console.log("Received all initial data! Commencing remaining 3000 tweets per user.");
        Object.keys(data).forEach(function(id) {
            var person = data[id];
            var numTweets = person.statuses_count;
            var numRequests = Math.min(16, Math.ceil(Math.max(0, numTweets - 200) / 200));
            get3000[person.id] = numRequests;
            if (numRequests > 0) {
                getUserTimeline(token, person.id, person.statuses[person.statuses.length-1].id);
            }
        });
    }
    // get200 < 0, now checking for remaining 3000
    else if (get200 < 0) {
        get3000[obj[0].user.id] -= 1;
        // if user still has remaining tweet requests
        if (get3000[obj[0].user.id] > 0) {
            var statuses = data[obj[0].user.id].statuses;
            getUserTimeline(token, obj[0].user.id, statuses[statuses.length - 1].id);
        }
        else {
            // check if all other tweet requests are done
            var flag = true;
            Object.keys(get3000).forEach(function(k) {
                if (get3000[k] > 0) {
                    flag = false;
                }
            });
            // update mongodb if getting the 3000 tweets of others is all done
            if (flag) {
                updateMongoDB();
            }
        }
    }
};

// Pulls the relevant userData specified at top of file
function updateUsers(obj) {
    var user = obj[0].user;
    var i = user.id_str;
    data[i] = data[i] || {};
    userData.forEach(function(d) {
        data[i][d] = user[d];
    });    
}

// stores relevant status data
function updateStatuses(statuses) {
    var userid = statuses[0].user.id_str;
    data[userid].statuses = data[userid].statuses || [];
    // data[userid].retweets = data[userid].retweets || [];

    Object.keys(statuses).forEach(function(i) {
        var tmp = {};
        var status = statuses[i];
        statusData.forEach(function(s) {
            tmp[s] = status[s];
        });
        
        // created_at will store a date obj instead of string
        tmp.created_at = new Date(status.created_at);

        // checks if retweet or status
        if (!status["retweeted_status"])
            data[userid].statuses.push(tmp);
        // else
        //     data[userid].retweets.push(tmp);
            
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
    
    mongoose.connect(
        process.env.MongoLabURI,
        function (err) {
            if (err)
                console.log ('DB connection error: ' + err) ;
        }
    );
    var Schema = mongoose.Schema;
    // Defines structure for document in mongodb.
    // Don't forget to change in node/modules if you want more or fewer metrics
    var userSchema = require('mongooseSchema');
    var User = mongoose.model('User', userSchema);
    var processed = 0;
    
    // Iterates through people in data, updating info or making new people
    Object.keys(data).forEach(function(k) {
        var person = data[k];

        User.findOne({ 'id': person.id }, function(err, foundPerson) {
            // If user doesn't exist
            var user;
            if (foundPerson === null) {
                user = new User(person);
                user.statuses = person.statuses;
            }
            else {
                foundPerson.followers_count = person.followers_count;
                foundPerson.friends_count = person.friends_count;
                foundPerson.listed_count = person.listed_count;
                user = foundPerson;
                var latest_date = foundPerson.statuses[0].created_at;
                var ctr = 0;
                while (ctr < person.statuses.length && person.statuses[ctr].created_at > latest_date) {
                    ctr++;
                }
                person.statuses.splice(ctr);
                foundPerson.statuses = person.statuses.concat(foundPerson.statuses);
                user = foundPerson;
            }

            // add up all the retweets and favorites
            var total_retweets = 0;
            var total_favorites = 0;
            user.statuses.forEach(function(status) {
                total_retweets += status.retweet_count;
                total_favorites += status.favorite_count;
            });
            user.total_retweets = total_retweets;
            user.total_favorites = total_favorites;

            user.save(function(err, record) {
                if (err)
                    return console.error(err);
                if (++processed === Object.keys(data).length) {
                    mongoose.connection.close();
                }
            });
        });
    });
}
