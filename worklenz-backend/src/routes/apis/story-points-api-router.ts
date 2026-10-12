import express from "express";

import StoryPointsController from "../../controllers/story-points-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const storyPointsApiRouter = express.Router();

storyPointsApiRouter.put(
  "/scale",
  requireProjectPermission("phases", { sources: ["body.project_id"] }),
  safeControllerFunction(StoryPointsController.updateScale)
);
storyPointsApiRouter.put(
  "/tasks/:taskId",
  requireProjectPermission("tasks", { sources: ["body.project_id"] }),
  safeControllerFunction(StoryPointsController.setTaskPoints)
);

export default storyPointsApiRouter;
