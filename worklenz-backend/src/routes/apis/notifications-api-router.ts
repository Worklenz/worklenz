import express from "express";

import NotificationController from "../../controllers/notification-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const notificationsApiRouter = express.Router();

notificationsApiRouter.get("/", safeControllerFunction(NotificationController.get));
notificationsApiRouter.get("/unread-count", safeControllerFunction(NotificationController.getUnreadCount));
notificationsApiRouter.delete("/:id", safeControllerFunction(NotificationController.delete));
notificationsApiRouter.put("/read-all", safeControllerFunction(NotificationController.readAll));
notificationsApiRouter.put("/:id", safeControllerFunction(NotificationController.update));

export default notificationsApiRouter;
