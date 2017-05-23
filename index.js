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
        //TODO
    }
}

var bot = new karmabot({
    token: '',
    dbPath: '',
    name: 'karmabot'
});

bot.on('start', function() {
    //setup and such
    bot.connectDb();
    //bot.postMessageToChannel('general', "Hey all, I'm really excited to let you know karmabot is starting up!");
});

bot.on('message', function(data) {
    //message handling and such
   console.log(data);
   if (!bot.isChatMessage(data)) {
       console.log('not a chat message');
        return;
   }

   if (!bot.isChannelConversation(data)) {
       console.log('not a conversation in a channel');
        return;
   }

   if (!bot.mentionsUser(data)) {
       console.log('doesnt mention a user');
       return;
   }

   if (bot.isKarmabotMessage(data)) {
       console.log('is karmabot msg');
       return;
   }

   console.log('should update scores');
   bot.updateScores(data);

});

