// server.js
// where your node app starts
// init project
var dotenv = require('dotenv').config();
var express = require('express');
var path = require('path');
var app = express();
var port = process.env.PORT || 3000;
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var shortid = require('shortid');
let multer = require('multer');
module.exports = {
    mongoose
};

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
app.use(express.static(__dirname + "/public"));

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

app.get("/exerciseTracker", (req, res) => {
    res.sendFile(__dirname + '/views/exerciseTracker.html');
})

app.get("/file-metadata-microservices", function (req, res) {
  res.sendFile(__dirname + '/views//file-metadata-microservices.html');
});

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
    original_url: String
}));

// parse application/json
app.use(bodyParser.json())

app.post("/api/shorturl/new",
    bodyParser.urlencoded({ extended: false }),
    (req, res) => {

    let client_requested_url = req.body.url

    let urlRegex = new RegExp(/^(http|https)(:\/\/)/);

    if (!client_requested_url.match(urlRegex)) {
        res.json({ error: "invalid url" });
        return;
    }

    let newShortURL = shortid.generate()

    let newURL = new ShortURL({
        short_url: newShortURL,
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

app.get("/api/shorturl/:input", (req, res) => {
    let input = req.params.input
    ShortURL.findOne({short_url: input}, (err, result) => {
        if (!err && result != undefined) {
            res.redirect(result.original_url);
        } else {
            res.json("URL not found");
        }
    });
})


// Exercise tracker
let exerciseSessionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: String
});

let User = mongoose.model("User", new mongoose.Schema({
  username: { type: String, required: true },
  log: [exerciseSessionSchema]
    })
);

let Session = mongoose.model("Session", exerciseSessionSchema);

app.post("/api/exercise/new-user/",
        bodyParser.urlencoded({ extended: false }),
        (req, res) => {
            let newUser = new User({ username: req.body.username });
            newUser.save((err, savedUser) => {
              if (err) return console.log(err);
              res.json({
                "username": savedUser.username,
                "_id": savedUser["_id"]
                });
            });
})

app.get("/api/exercise/users", (req, res) => {
  User.find({}, (err, allUsers) => {
    if (err) return console.log(err)
      res.json(allUsers);
  });
});

app.post(
    "/api/exercise/add",
    bodyParser.urlencoded({extended: false}),
    (req, res) => {
        let newSession = new Session({
            description: req.body.description,
            duration: parseInt(req.body.duration),
            date: req.body.date
        });

        if (newSession.date === "") {
            newSession.date = new Date().toISOString().substring(0, 10);
        }

        User.findByIdAndUpdate(
            req.body.userId,
            {$push: {log: newSession}},
            {new: true},
            (err, updatedUser) => {
                if (err) return console.log(err)
                console.log(updatedUser)
                res.json({
                    "_id": updatedUser.id,
                    "username": updatedUser.username,
                    "date": new Date(newSession.date).toDateString(),
                    "description": newSession.description,
                    "duration": newSession.duration
                })
            }
        )
    }
)

app.get("/api/exercise/log", (req, res) => {
    User.findById(req.query.userId, (err, result) => {
        if (err) return console.log(err)
        let responseObject = result
        if (req.query.from || req.query.to) {
            let fromDate = new Date(0);
            let toDate = new Date();


            if (req.query.from) {
                fromDate = new Date(req.query.from);
            }

            if (req.query.to) {
                toDate = new Date(req.query.to);
            }

            fromDate = fromDate.getTime();
            toDate = toDate.getTime();

            responseObject.log = responseObject.log.filter(session => {
                let sessionDate = new Date(session.date).getTime();

                return sessionDate >= fromDate && sessionDate <= toDate;
            });
        }

        if (req.query.limit) {
            responseObject.log = responseObject.log.slice(0, req.query.limit);
        }

        responseObject = responseObject.toJSON()
        responseObject["count"] = result.log.length;
        res.json(responseObject);
    })
})

app.post('/api/fileanalyse', multer().single('upfile'), (req, res) => {
    res.json({
        "name" : req.file.originalname,
        "type" : req.file.mimetype,
        "size" : req.file.size
    })
})

// listen for requests :)
var listener = app.listen(port, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
