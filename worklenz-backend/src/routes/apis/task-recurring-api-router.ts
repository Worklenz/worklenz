import express from "express";

import TaskRecurringController from "../../controllers/task-recurring-controller";
import { verifyTaskAccessViaSchedule } from "../../middlewares/verify-task-access";

const taskRecurringApiRouter = express.Router();

taskRecurringApiRouter.get("/:id", verifyTaskAccessViaSchedule('params', 'id'), TaskRecurringController.getById);
taskRecurringApiRouter.put("/:id", verifyTaskAccessViaSchedule('params', 'id'), TaskRecurringController.updateSchedule);

export default taskRecurringApiRouter;