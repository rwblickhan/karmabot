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
        return message.text.indexOf('@') > -1;
    }

    isKarmabotMessage(data) {
        return data.user === getUserId('karmabot');
    }

    mentionsKarmabot(data) {
        var words = data.text.split(' ');
        for (word of words) {
            if (word === "@karmabot") {
                return true;
            }
        }
        return false;
    }
}

var bot = new karmabot({
    token: 'xoxb-187038183317-DpKTYbEAjLECJvLCqYdJ2w2o',
    dbPath: '',
    name: 'karmabot'
});

bot.on('start', function() {
    //setup and such
    bot.connectDb();
    bot.postMessageToChannel('general', "Hey all, I'm really excited to let you know karmabot is starting up!");
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

   if (bot.mentionsKarmabot(data)) {
        //TODO show help and such
        return;
   }

   bot.updateScores(data);

});

