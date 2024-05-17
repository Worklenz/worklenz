import express from "express";
import TaskPrioritiesController from "../../controllers/task-priorities-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const prioritiesApiRouter = express.Router();

prioritiesApiRouter.get("/task-priorities/:id", idParamValidator, safeControllerFunction(TaskPrioritiesController.getById));

export default prioritiesApiRouter;
