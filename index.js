#!/usr/bin/env node

'use strict';

var slackbots = require('slackbots');
var process  = require('process');
var path = require('path');
var fs = require('fs');
var sqlite = require('sqlite3').verbose();

var token  = process.env.KARMABOT_API_KEY;
var dbPath = process.env.KARMABOT_DB_PATH;
var name   = process.env.KARMABOT_NAME;
var floodlimit = process.env.FLOOD_CONTROL_LIMIT;

class karmabot extends slackbots {
    
    constructor(options) {
        super(options);
        this.dbPath = options.dbPath || path.resolve(process.cwd(), 'karmabot.db');
        this.db = null;
    }

    connectDb() {
        if (!fs.existsSync(this.dbPath)) {
            fs.closeSync(fs.openSync(this.dbPath, 'w'));
        }
        
        this.db = new sqlite.Database(this.dbPath);
        this.db.run('CREATE TABLE IF NOT EXISTS data (userid TEXT, points INTEGER)', function(err) {
            if (err) {
                console.error("Database error: " + err);
                process.exit(1);
            }
        });
    }

    isChatMessage(data) {
        return data.type === 'message' && Boolean(data.text);
    }

    isChannelConversation(data) {
        return typeof data.channel === 'string' && data.channel[0] === 'C';
    }

    mentionsUser(data) {
        return data.text.indexOf('@') > -1;
    }

    isKarmabotMessage(data) {
        return data.username === 'karmabot';
    } 

    updateScores(data) {

        var words = data.text.split(' ');
        var regex = /<@.+>/;
        for (var word of words) {
            if (!regex.test(word)) {
                //not an @message
                continue;
            }

            var substart = word.indexOf('@');
            var subend = word.indexOf('>');
            var userid = word.substring(substart+1, subend);
            if (data.user === userid) {
                this.postMessageToChannel('general', "Hey, no cheating, <@" + userid + ">!");
                continue;
            }
            
            //parse points to give
            var pointstr = word.substring(subend);
            var numPos = 0;
            var numNeg = 0;
            for (var i = 0; i < pointstr.length; i++) {
                if (pointstr[i] === '+') {
                    numPos++;
                }
                if (pointstr[i] === '-') {
                    numNeg++;
                }
            }

            var points = 0;
            if (numPos > 1) {
                var change = Math.min((numPos - 1), floodlimit);
                points += change; 
            }
            if (numNeg > 1) {
                var change = Math.min((numNeg - 1), floodlimit);
                points -= change;
            }

            if (numPos === 0 && numNeg === 0) {
                return;
            }

            var self = this;
            self.db.get('SELECT * FROM data WHERE userid = ? LIMIT 1', userid, function(err, record) {
                if (err) {
                    return console.error("Database error: " + err);
                }

                if (!self.db) {
                    console.log("db is gone");
                }

                if (!record) {
                    self.db.run('INSERT INTO data(userid, points) VALUES(?, ?)', [userid, points], function(err) {
                        if (err) {
                            return console.error("Database error: " + err);
                        }
                        self.postMessageToChannel('general', "Hey, <@" + userid + "> now has " + points + " points!"); 
                    });
                } else {
                    var total = parseInt(record.points) + points;
                    self.db.run('UPDATE data SET points = ? WHERE userid = ?', [total, userid], function(err) {
                        if (err) {
                           return console.error("Database error: " + err);
                        }
                        self.postMessageToChannel('general', "Hey, <@" + userid + "> now has " + total + " points!");
                    });
                } 
            });
        }
    }
}

var bot = new karmabot({
    token: token,
    dbPath: dbPath,
    name: name
});

bot.on('start', function() {
    //setup and such
    bot.connectDb();
    bot.postMessageToChannel('general', "Hey all, I'm really excited to let you know karmabot is starting up!");
});

bot.on('message', function(data) {
    console.log(data);
    //message handling and such
    if (!bot.isChatMessage(data)) {
        console.log("Not a chat message");
        return;
    }

    if (!bot.isChannelConversation(data)) {
        console.log("Not a channel conversation");
        return;
    }

    if (!bot.mentionsUser(data)) {
        console.log("Doesn't mention a user");
       return;
    }

    if (bot.isKarmabotMessage(data)) {
       console.log("Is a karmabot message");
       return;
    }

    bot.updateScores(data);

});

