#!/usr/bin/env node

// config should be imported at the top of this file.
import "./config";

import {Server, Socket} from "socket.io";
import http, {IncomingHttpHeaders} from "http";

import app from "../app";
import {register} from "../socket.io";
import {IO} from "../shared/io";
import sessionMiddleware from "../middlewares/session-middleware";
import {getLoggedInUserIdFromSocket} from "../socket.io/util";
import {startCronJobs} from "../cron_jobs";
import FileConstants from "../shared/file-constants";
import {initRedis} from "../redis/client";
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

const io = new Server(server, {
  transports: ["websocket"],
  path: "/socket",
  cors: {
    origin: (process.env.SOCKET_IO_CORS || "*").split(",")
  },
  cookie: true
});

const wrap = (middleware: any) => (socket: any, next: any) => middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));

io.use((socket, next) => {
  // Check for regular user authentication
  const userId = getLoggedInUserIdFromSocket(socket);
  if (userId) {
    return next();
  }
  
  // Check for client portal authentication via handshake auth
  const auth = socket.handshake.auth;
  if (auth && auth.token && auth.type === 'client') {
    // Client portal authentication will be handled in on_client_connect
    return next();
  }
  
  return next(new Error("401 unauthorized"));
});

io.engine.on("initial_headers", (headers: IncomingHttpHeaders) => {
  headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  headers["X-Content-Type-Options"] = "nosniff";
  headers["X-Frame-Options"] = "Deny";
  headers["X-XSS-Protection"] = "1; mode=block";
});

io.on("connection", (socket: Socket) => {
  register(io, socket);
});

IO.setInstance(io);

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

  process.env.ENABLE_EMAIL_CRONJOBS === "true" && startCronJobs();
  // void initRedis();
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

server.listen(port);
