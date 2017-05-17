var karmabot = require('./karmabot.js');
var process  = require('process');

var token  = process.env.KARMABOT_API_KEY;
var dbPath = process.env.KARMABOT_DB_PATH;
var name   = process.env.KARMABOT_NAME;

var bot = new karmabot({
    token: token,
    dbPath: dbPath,
    name: name
});

bot.run();
