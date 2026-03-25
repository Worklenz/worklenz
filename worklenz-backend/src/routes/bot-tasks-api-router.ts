import express from "express";
import botAuthMiddleware from "../middlewares/bot-auth-middleware";
import BotTasksController from "../controllers/bot-tasks-controller";

const botTasksApiRouter = express.Router();

// All bot routes require service account JWT auth
botTasksApiRouter.use(botAuthMiddleware);

botTasksApiRouter.post("/tasks", BotTasksController.create);

export default botTasksApiRouter;
