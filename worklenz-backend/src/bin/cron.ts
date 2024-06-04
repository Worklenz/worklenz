#!/usr/bin/env node

// config should be imported at the top of this file.
import "./config";
import http, {IncomingHttpHeaders} from "http";
import app from "../app";
import {startCronJobs} from "../cron_jobs";
import FileConstants from "../shared/file-constants";
import DbTaskStatusChangeListener from "../pg_notify_listeners/db-task-status-changed";

function normalizePort(val?: string) {
  const p = parseInt(val || "0", 10);
  if (isNaN(p)) return val; // named pipe
  if (p >= 0) return p; // port number
  return false;
}

const port = normalizePort(process.env.PORT);
app.set("port", port);

const server = http.createServer(app);

function onError(error: any) {
  DbTaskStatusChangeListener.disconnect();

  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string"
    ? `Pipe ${port}`
    : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  if (!addr) return;

  const bind = typeof addr === "string"
    ? `pipe ${addr}`
    : `port ${addr.port}`;
  startCronJobs();
  FileConstants.init();
  void DbTaskStatusChangeListener.connect();

  console.info(`Listening on ${bind}`);
}

function onClose() {
  DbTaskStatusChangeListener.disconnect();
}

server.on("error", onError);
server.on("close", onClose);
server.on("listening", onListening);

process.on("SIGINT", () => {
  server.close();
});

server.listen(port, () => {
    console.log(`Cron server successfully started on port ${port} !`);
});