import * as fs from "fs";
import * as path from "path";
import * as sql from "sqlite3";
import * as log from "debug";
import {isNullOrUndefined} from "util";

const logDebug = log("karmabot::debug");
const logTrace = log("karmabot::trace");

class Karmabot {
    private token: string;
    private name: string;
    private floodLimit: number;
    private db: sql.Database;

    constructor(options: IOptions) {
        logTrace("karmabot::constructor()");
        this.token = options.token;
        this.name = options.name;
        this.floodLimit = parseInt(options.floodLimit, 10);
        logDebug("Creating karmabot with name " + this.name + " and flood limit " + this.floodLimit);

        const dbPath = options.dbPath || path.resolve(process.cwd(), "karmabot.db");
        logDebug("Using database path: " + dbPath);
        if (!fs.existsSync(dbPath)) {
            fs.closeSync(fs.openSync(dbPath, "w"));
        }
        this.db = new sql.Database(dbPath);
        this.db.run("CREATE TABLE IF NOT EXISTS data (userid TEXT, points INTEGER)", function (err) {
            if (err) {
                logDebug("Error creating database: " + err);
                process.exit(1);
            } else {
                logDebug("Database created");
            }
        });
    }
}

interface IOptions {
    token: string;
    dbPath: string | null;
    name: string;
    floodLimit: string;
}

if (isNullOrUndefined(process.env.KARMABOT_API_KEY)) {
    logDebug("Missing API token");
    process.exit(1);
}
const token: string = process.env.KARMABOT_API_KEY as string;
const dbPath: string | null = process.env.KARMABOT_DB_PATH || null;
const name: string = process.env.KARMABOT_NAME || "Karmabot";
const floodLimit: string = process.env.FLOOD_CONTROL_LIMIT || "10";

const bot = new Karmabot({token, dbPath, name, floodLimit});
