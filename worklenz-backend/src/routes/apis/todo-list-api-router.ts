import express from "express";

import TodoListController from "../../controllers/todo-list-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import todoListBodyValidator from "../../middlewares/validators/todo-list-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const todoListApiRouter = express.Router();

todoListApiRouter.post("/", todoListBodyValidator, safeControllerFunction(TodoListController.create));
todoListApiRouter.get("/", safeControllerFunction(TodoListController.get));
todoListApiRouter.put("/index", safeControllerFunction(TodoListController.updateIndex));
todoListApiRouter.put("/status/:id", idParamValidator, safeControllerFunction(TodoListController.updateStatus));
todoListApiRouter.put("/:id", idParamValidator, todoListBodyValidator, safeControllerFunction(TodoListController.update));
todoListApiRouter.delete("/:id", idParamValidator, safeControllerFunction(TodoListController.deleteById));

export default todoListApiRouter;
