import path from "node:path";
import winston from "winston";

const filename = path.join(__dirname, "../../logs", "application.log");

// define the custom settings for each transport (file, console)
const options = {
  file: {
    level: "info",
    filename,
    handleExceptions: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  },
  console: {
    level: "debug",
    handleExceptions: true,
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  },
};

// instantiate a new Winston Logger with the settings defined above
const logger = winston.createLogger({
  transports: [
    new winston.transports.File(options.file),
    new winston.transports.Console(options.console),
  ],
  exitOnError: false, // do not exit on handled exceptions
});

export default {logger};
