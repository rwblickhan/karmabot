var util      = require('util');
var path      = require('path');
var process   = require('process');
var fs        = require('fs');
var sqlite    = require('sqlite3');
var slackbots = require('slackbots');

var karmabot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'karmabot';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'karmabot.db');

    this.user = null;
    this.db = null;
};

util.inherits(karmabot, slackbots);

module.exports = karmabot;

karmabot.prototype.run = function() {
    karmabot.super_.call(this, this.settings);

    this.on('start', this.onStart);
    this.on('message', this.onMessage);
};

karmabot.prototype.onStart = function() {
    this.loadUser();
    this.connectDb();
    this.sendStartupMessage();
};

karmabot.prototype.loadUser = function() {
    var self = this;
    this.user = this.users.filter(function(user) {
        return user.name == self.name;   
    })[0];
};

karmabot.prototype.connectDb = function() {
    if (!fs.existsSync(this.dbPath)) {
        //TODO create database
    }
    this.db = new sqlite.Database(this.dbPath);
};

karmabot.prototype.sendStartupMessage = function() {
    bot.postMessageToChannel('general', "Hey all, I'm really excited to let you know karmabot has started up!");
};

karmabot.prototype.onMessage = function() {
    if (!this.isChatMessage(message) ||
        !this.isChannelConversation(message) ||
        !this.mentionsUser(message) ||
        this.isKarmabotMessage(message)) {
        //message doesn't need processing
        return;
    };

    if (this.mentionsKarmabot(message)) {
        //TODO: display help/options/etc

        return;
    };

    this.updateScores(message);
};

karmabot.prototype.isChatMessage = function(message) {
    return message.type === 'message' && Boolean(message.text);
};

karmabot.prototype.isChannelConversation = function(message) {
    return typeof message.channel === 'string' && message.channel[0] === 'C';
};

karmabot.prototype.mentionsUser = function(message) {
    return message.text.indexOf('@') > -1
};

karmabot.prototype.isKarmabotMessage = function(message) {
    return message.user === this.user.id;
};

karmabot.prototype.mentionsKarmabot = function(message) {
    var words = message.text.split(' ');
    for (word of words) {
        if (word === '@karmabot') {
            return True;
        }
    }

    return False;
};

karmabot.prototype.updateScores = function(message) {
    var updates = [];
    var words = message.text.split(' '); 
    for (word of words) {
        if (word[0] != '@') {
            continue;
        }

        var update = {
            username: '',
            score: 0,
            channel: ''
        };

        update.channel = message.channel;

        var pointsIndex = word.indexOf('+');
        if (pointsIndex <= -1) {
            pointsIndex = word.idnexOf('-');
        };

        username = word.substr(1, pointsIndex);
        if (!this.users.includes(username))
        {
            continue;
        }
        update.username = username;

        points = word.substr(pointsIndex);
        var posPoints = 0;
        var negPoints = 0;
        for (point of points) {
            if (point === '+') {
                posPoints++;
            }
            if (point === '-') {
                negPoints++;
            } 
        }

        if (posPoints > 2)
        {
            update.score += (posPoints - 1);
        }

        if (negPoints > 2)
        {
            update.score -= (negPoints - 1);
        }

        updates.push(update);
    }

    for (update of updates) {
        this.db.get('SELECT score FROM info WHERE username = "' + update.username + '"', function(err, record) {
            if (err) {
                return console.error('Database error:', err);
            }

            if (!record) {
                //user has no record
                this.db.run('INSERT INTO score(username, score) VALUES("' + update.username + '", ' + update.score + ')');
                this.notifyChannel(update.username, update.score, update.channel);
                return;
            }

            this.db.run('UPDATE info SET score = ' + (record.score + update.score) + ' WHERE username = "' + update.username + '"');
            this.notifyChannel(update.username, (record.score + update.score), update.channel);
            return;
        });
    }
};

karmabot.prototype.notifyChannel = function(user, score, channel) {
    this.postMessageToChannel(channel, user + "'s score is now " + score + "!");
};
