import express from "express";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import ProjectActivityLogsController from "../../controllers/project-activity-logs-controller";

const projectActivityLogsApiRouter = express.Router();

// Match the client URL (/project/:projectId) and ensure param name lines up
projectActivityLogsApiRouter.get(
  "/project/:id",
  // Validate that id is a proper UUID
  idParamValidator,
  // Wrap the controller to catch and forward errors
  safeControllerFunction(ProjectActivityLogsController.getByProjectId)
);

// Optional health‐check endpoint
projectActivityLogsApiRouter.get("/test", (req, res) => {
  res.json({ message: "Project activity logs router is working!" });
});

export default projectActivityLogsApiRouter;