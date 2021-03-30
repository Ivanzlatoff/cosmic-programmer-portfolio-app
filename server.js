// server.js
// where your node app starts
// init project
var express = require('express');
var app = express();
var port = process.env.PORT || 3000;
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var shortid = require('shortid');
require('dotenv').config();

mongoose.Promise = global.Promise;
mongoose.connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
    });

// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC
var cors = require('cors');
app.use(cors({optionsSuccessStatus: 200}));  // some legacy browsers choke on 204

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

app.get("/timestamp", function (req, res) {
  res.sendFile(__dirname + '/views/timestamp.html');
});

app.get("/requestHeaderParser", (req, res) => {
    res.sendFile(__dirname + '/views/requestHeaderParser.html');
})

app.get("/urlShortenerMicroservice", (req, res) => {
    res.sendFile(__dirname + '/views/urlShortenerMicroservice.html');
})


// your first API endpoint...
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// Timestamp Project
app.get("/api/timestamp", (req, res) => {
    let now = new Date();
    res.json({"unix": now.getTime(), "utc": now.toUTCString()})
})

app.get("/api/timestamp/:date_string", (req, res) => {
    let dateString = req.params.date_string;

    if (dateString.match(/^\d+$/)) {
        let unixTime = new Date(parseInt(dateString))
        res.json({"unix": unixTime.getTime(), "utc": unixTime.toUTCString()})
    }

    let passedInValue = new Date(dateString)

    if (passedInValue == "Invalid Date") {
        res.json({"error": "Invalid Date"})
    } else {
        res.json({"unix": passedInValue.getTime(), "utc": passedInValue.toUTCString()})
    }
})

// Header Request
app.enable('trust proxy')
app.get("/api/whoami", (req, res) => {
    res.json({"ipaddress": req.ip,
            "language": req.headers["accept-language"],
            "software": req.headers["user-agent"]
        })
})

// URLs Shortening Service

// Build a schema and model to store saved URLS
const ShortURL = mongoose.model('ShortURL', new mongoose.Schema({
    short_url: String,
    original_url: String,
    suffix: String }));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.post("/api/shorturl/new", (req, res) => {

    let client_requested_url = req.body.url
    let suffix = shortid.generate()
    let newShortURL = suffix

    let newURL = new ShortURL({
        short_url: suffix,
        original_url: client_requested_url
    })

    newURL.save((err, doc) => {
        if (err) return console.log(err);
        console.log("Document inserted succesfully!")
        res.json({
            "short_url": newURL.short_url,
            "original_url": newURL.original_url,
        });
    });
})

app.get("/api/shorturl/:suffix", (req, res) => {
    let userGeneratedSuffix = req.params.suffix
    console.log(userGeneratedSuffix)
    ShortURL.find({short_url: userGeneratedSuffix}).then(foundUrls => {
        let urlForRedirect = foundUrls[0];
        res.redirect(urlForRedirect.original_url)
    });
})


// listen for requests :)
var listener = app.listen(port, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
