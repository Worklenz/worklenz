import express from "express";

import TaskRecurringController from "../../controllers/task-recurring-controller";
import verifyTaskAccess from "../../middlewares/verify-task-access";

const taskRecurringApiRouter = express.Router();

taskRecurringApiRouter.get("/:id", verifyTaskAccess('params', 'id'), TaskRecurringController.getById);
taskRecurringApiRouter.put("/:id", verifyTaskAccess('params', 'id'), TaskRecurringController.updateSchedule);

export default taskRecurringApiRouter;