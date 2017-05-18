'use strict';

var util      = require('util');
var path      = require('path');
var process   = require('process');
var fs        = require('fs');
var sqlite    = require('sqlite3');
var slackbots = require('slackbots');

class karmabot extends slackbots {
    constructor(options) {
        super(options);
        this.options = options;
        this.options.name = this.options.name || 'karmabot';
        this.dbPath = options.dbPath || path.resolve(process.cwd(), 'karmabot.db');

        this.user = null;
        this.db = null;
    }

    run() {
        this.on('start', this.onStart);
        this.on('message', this.onMessage);
    }

    onStart() { 
        this.loadUser();
        this.connectDb();
        this.sendStartupMessage();
    }

    loadUser() {
        var self = this;
        this.user = this.users.filter(function(user) {
            return user.name == self.name;   
        })[0];
    }

    connectDb() {
        if (!fs.existsSync(this.dbPath)) {
            //TODO create database
        }
        this.db = new sqlite.Database(this.dbPath);
    }

    sendStartupMessage() {
        bot.postMessageToChannel('general', "Hey all, I'm really excited to let you know karmabot has started up!");
    }

    onMessage() {
        if (!this.isChatMessage(message) ||
        !this.isChannelConversation(message) ||
        !this.mentionsUser(message) ||
        this.isKarmabotMessage(message)) {
            //message doesn't need processing
            return;
        }

        if (this.mentionsKarmabot(message)) {
            //TODO: display help/options/etc

            return;
        }

        this.updateScores(message);

    }

    isChatMessage(message) {
        return message.type === 'message' && Boolean(message.text);
    }

    isChannelConversation(message) {
        return typeof message.channel === 'string' && message.channel[0] === 'C';
    }

    mentionsUser(message) {
        return message.text.indexOf('@') > -1;
    }

    isKarmabotMessage(message) {
        return message.user === this.user.id;
    }

    mentionsKarmabot(message) {
        var words = message.text.split(' ');
        for (word of words) {
            if (word === '@karmabot') {
                return True;
            }
        }
        return False;
    }

    updateScores(message) {
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
    }

    notifyChannel(user, score, channel) {
        this.postMessageToChannel(channel, user + "'s score is now " + score + "!");
    }

}

module.exports = karmabot;
