import express from 'express';

import UserActivityLogsController from '../../controllers/user-activity-logs-controller';
import safeControllerFunction from "../../shared/safe-controller-function";

const userActivityLogsApiRouter = express.Router();

userActivityLogsApiRouter.get('/user-recent-tasks', safeControllerFunction(UserActivityLogsController.getRecentTasks));
userActivityLogsApiRouter.get('/user-time-logged-tasks', safeControllerFunction(UserActivityLogsController.getTimeLoggedTasks));

export default userActivityLogsApiRouter;