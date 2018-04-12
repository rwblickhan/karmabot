#!/usr/bin/env node

'use strict';

const slackbots = require('slackbots');
const process  = require('process');
const path = require('path');
const fs = require('fs');
const sqlite = require('sqlite3').verbose();

const token  = process.env.KARMABOT_API_KEY;
const dbPath = process.env.KARMABOT_DB_PATH;
const name   = process.env.KARMABOT_NAME;
const floodlimit = process.env.FLOOD_CONTROL_LIMIT;

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

    static isChatMessage(data) {
        return data.type === 'message' && Boolean(data.text);
    }

    static isChannelConversation(data) {
        return typeof data.channel === 'string' && data.channel[0] === 'C';
    }

    static mentionsUser(data) {
        return data.text.indexOf('@') > -1;
    }

    static isKarmabotMessage(data) {
        return data.username === 'karmabot';
    } 

    updateScores(data) {

        const words = data.text.split(' ');
        const regex = /<@.+>/;
        for (const word of words) {
            if (!regex.test(word)) {
                //not an @message
                continue;
            }

            const substart = word.indexOf('@');
            const subend = word.indexOf('>');
            const userid = word.substring(substart+1, subend);
            if (data.user === userid) {
                this.postMessageToChannel('general', "Hey, no cheating, <@" + userid + ">!");
                continue;
            }
            
            //parse points to give
            const pointstr = word.substring(subend);
            let numPos = 0;
            let numNeg = 0;
            for (const i = 0; i < pointstr.length; i++) {
                if (pointstr[i] === '+') {
                    numPos++;
                }
                if (pointstr[i] === '-') {
                    numNeg++;
                }
            }

            let points = 0;
            if (numPos > 1) {
                points += Math.min((numPos - 1), floodlimit);
            }
            if (numNeg > 1) {
                points -= Math.min((numNeg - 1), floodlimit);
            }

            if (numPos === 0 && numNeg === 0) {
                return;
            }

            const self = this;
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
                    const total = parseInt(record.points) + points;
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

const bot = new karmabot({
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

