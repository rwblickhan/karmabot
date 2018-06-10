import * as fs from "fs";
import * as path from "path";
import * as slack from "@slack/client";
import * as sql from "sqlite3";
import * as log from "debug";
import {isNullOrUndefined} from "util";

const logDebug = log("karmabot::debug");
const logTrace = log("karmabot::trace");
const logError = log("karmabot::error");

class Karmabot {
    private static token: string;
    private static floodLimit: number;
    private static db: sql.Database;
    private static connection: slack.RTMClient;
    private static channel: string;

    private static isChatMessage(event: any): boolean {
        logTrace("karmabot::isChatMessage()");
        return event.type === "message" && !isNullOrUndefined(event.text);
    }

    private static isChannelConversation(event: any) {
        logTrace("karmabot::isChannelConversation()");
        return typeof event.channel === "string" && event.channel[0] === "C";
    }

    private static mentionsUser(event: any) {
        logTrace("karmabot::mentionsUser()");
        return event.text.indexOf("@") > -1;
    }

    private static isKarmabotMessage(event: any) {
        logTrace("karmabot::isKarmabotMessage()");
        return event.username === "karmabot";
    }

    constructor(options: IOptions) {
        logTrace("karmabot::constructor()");
        Karmabot.token = options.token;
        Karmabot.floodLimit = parseInt(options.floodLimit, 10);
        Karmabot.channel = "";
        logDebug("Creating karmabot with flood limit " + Karmabot.floodLimit);

        const finalDBPath = options.dbPath || path.resolve(process.cwd(), "karmabot.db");
        logDebug("Using database path: " + finalDBPath);
        if (!fs.existsSync(finalDBPath)) {
            fs.closeSync(fs.openSync(finalDBPath, "w"));
        }
        Karmabot.db = new sql.Database(finalDBPath);
        Karmabot.db.run("CREATE TABLE IF NOT EXISTS data (userid TEXT, points INTEGER)", function (err) {
            if (err) {
                logError("Error creating database: " + err);
                // TODO error handling
                Karmabot.db.close();
                process.exit(1);
            } else {
                logDebug("Database created");
            }
        });

        Karmabot.connection = new slack.RTMClient(Karmabot.token);
        Karmabot.connection.start({});
        const client = new slack.WebClient(Karmabot.token);
        client.channels.list()
            .then((res: any) => {
                const general = res.channels.find((c: any) => c.name === "general");
                if (general) {
                    Karmabot.connection.sendMessage(
                        "Hey all, I'm really excited to let you know karmabot is starting up!",
                        general.id,
                    );
                }
            })
            .catch((err) => {
                logError("Startup error: " + err);
            });

        Karmabot.connection.on("message", this.updateScores);
    }

    // TODO make Karmabot parameter not any
    private updateScores(event: any) {
        logTrace("karmabot::updateScore()");
        if (!Karmabot.isChatMessage(event)) {
            logDebug("Event was not a chat message");
            return;
        }

        if (!Karmabot.isChannelConversation(event)) {
            logDebug("Event was not a channel conversation");
            return;
        }

        if (!Karmabot.mentionsUser(event)) {
            logDebug("Event did not mention a user");
            return;
        }

        if (Karmabot.isKarmabotMessage(event)) {
            logDebug("Event was a karmabot message");
            return;
        }

        logDebug("Event was a valid message");

        const words = event.text.split(" ");
        const regex = /<@.+>/;
        for (const word of words) {
            if (!regex.test(word)) {
                logDebug("Event was not an @message");
                continue;
            }

            const substart = word.indexOf("@");
            const subend = word.indexOf(">");
            const userid = word.substring(substart + 1, subend);
            if (event.user === userid) {
                logDebug("Detected cheating");
                Karmabot.connection.sendMessage("Hey, no cheating, <@" + userid + ">!",
                    event.channel);
                return;
            }

            const pointstr = word.substring(subend);
            let numPos = 0;
            let numNeg = 0;
            for (const char of pointstr) {
                if (char === "+") {
                    numPos++;
                }
                if (char === "-") {
                    numNeg++;
                }
            }

            let points = 0;
            if (numPos > 1) {
                points += Math.min((numPos - 1), Karmabot.floodLimit);
            }
            if (numNeg > 1) {
                points -= Math.min((numNeg - 1), Karmabot.floodLimit);
            }

            if (numPos === 0 && numNeg === 0) {
                return;
            }

            Karmabot.db.get("SELECT * FROM data WHERE userid = ? LIMIT 1", userid, function (readErr, record) {
                if (readErr) {
                    logError("Error while reading from database: " + readErr);
                    // TODO error handling
                    Karmabot.db.close();
                    process.exit(1);
                }

                if (!record) {
                    Karmabot.db.run("INSERT INTO data(userid, points) VALUES(?, ?)", [userid, points],
                        function (writeErr) {
                            if (writeErr) {
                                logError("Error while writing to database: " + writeErr);
                                // TODO error handling
                                Karmabot.db.close();
                                process.exit(1);
                            }
                            Karmabot.connection.sendMessage("Hey, <@" + userid + "> now has " + points + " points!",
                                event.channel);
                        });
                } else {
                    const total = parseInt(record.points, 10) + points;
                    Karmabot.db.run("UPDATE data SET points = ? WHERE userid = ?", [total, userid],
                        function (writeErr) {
                            if (writeErr) {
                                logError("Error while writing to database: " + writeErr);
                                // TODO error handling
                                Karmabot.db.close();
                                process.exit(1);
                            }
                            Karmabot.connection.sendMessage("Hey, <@" + userid + "> now has " + total + " points!",
                                event.channel);
                        });
                }
            });
        }
    }
}

interface IOptions {
    token: string;
    dbPath: string | null;
    floodLimit: string;
}

if (isNullOrUndefined(process.env.KARMABOT_API_KEY)) {
    logError("Missing API token");
    process.exit(1);
}
const token: string = process.env.KARMABOT_API_KEY as string;
const dbPath: string | null = process.env.KARMABOT_DB_PATH || null;
const floodLimit: string = process.env.FLOOD_CONTROL_LIMIT || "10";

const bot = new Karmabot({token, dbPath, floodLimit});
