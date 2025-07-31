import dotenv from "dotenv";
import SegfaultHandler from "segfault-handler";

dotenv.config();
global.Promise = require("bluebird");
SegfaultHandler.registerHandler("crash.log");
