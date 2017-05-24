var slackbots = require('slackbots');
var process  = require('process');
var path = require('path');

var token  = process.env.KARMABOT_API_KEY;
var dbPath = process.env.KARMABOT_DB_PATH;
var name   = process.env.KARMABOT_NAME;

class karmabot extends slackbots {
    
    constructor(options) {
        super(options);
        this.dbPath = options.dbPath || path.resolve(process.cwd(), 'karmabot.db');
        this.db = null;
    }

    connectDb() {
        //TODO
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
        return data.user === this.getUserId('karmabot');
    } 

    updateScores(data) {

        console.log(data);
        console.log("text:" + data.text);

        var words = data.text.split(' ');
        var regex = /<@.+>/;
        for (var word of words) {
            if (!regex.test(word)) {
                //not an @message
                return;
            }

            //TODO parse username to give points to
            var substart = word.indexOf('@');
            var subend = word.indexOf('>');
            var userid = word.substring(substart+1, subend);
            
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
                points += (numPos - 1);
            }
            if (numNeg > 1) {
                points -= (numNeg - 1);
            }

            //TODO update database and whatnot
            //TODO post update message
            console.log("user " + userid + " got this many points: " + points);
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
    //bot.postMessageToChannel('general', "Hey all, I'm really excited to let you know karmabot is starting up!");
});

bot.on('message', function(data) {
    //message handling and such
    if (!bot.isChatMessage(data)) {
        return;
    }

    if (!bot.isChannelConversation(data)) {
        return;
    }

    if (!bot.mentionsUser(data)) {
       return;
    }

    if (bot.isKarmabotMessage(data)) {
       return;
    }

    bot.updateScores(data);

});

