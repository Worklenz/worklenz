import dotenv from "dotenv";

dotenv.config();
global.Promise = require("bluebird");

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SegfaultHandler = require("segfault-handler");
  SegfaultHandler.registerHandler("crash.log");
} catch (err) {
  console.warn("segfault-handler native module unavailable, skipping crash handler registration");
}
