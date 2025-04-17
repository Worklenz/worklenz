import express from "express";

import TaskRecurringController from "../../controllers/task-recurring-controller";

const taskRecurringApiRouter = express.Router();

taskRecurringApiRouter.get("/:id", TaskRecurringController.getById);
taskRecurringApiRouter.put("/:id", TaskRecurringController.updateSchedule);

export default taskRecurringApiRouter;