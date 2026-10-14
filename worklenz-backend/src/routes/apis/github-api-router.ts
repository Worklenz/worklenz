import express from "express";
import GithubController from "../../controllers/github-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const githubApiRouter = express.Router();

// Team level
githubApiRouter.get("/status", safeControllerFunction(GithubController.getStatus));
githubApiRouter.get("/install-url", safeControllerFunction(GithubController.getInstallUrl));
githubApiRouter.get("/callback", GithubController.installCallback as any);
githubApiRouter.delete("/disconnect", safeControllerFunction(GithubController.disconnect));
githubApiRouter.post("/repositories/refresh", safeControllerFunction(GithubController.refreshRepositories));

// Project level (software projects; requires project settings permission)
const projectSettings = requireProjectPermission("settings", { sources: ["params.projectId"] });
githubApiRouter.get(
  "/projects/:projectId/repositories",
  requireProjectPermission("tasks", { sources: ["params.projectId"] }),
  safeControllerFunction(GithubController.getProjectRepositories),
);
githubApiRouter.post(
  "/projects/:projectId/repositories",
  projectSettings,
  safeControllerFunction(GithubController.linkRepository),
);
githubApiRouter.put(
  "/projects/:projectId/repositories/:linkId",
  projectSettings,
  safeControllerFunction(GithubController.updateRepositoryLink),
);
githubApiRouter.delete(
  "/projects/:projectId/repositories/:linkId",
  projectSettings,
  safeControllerFunction(GithubController.unlinkRepository),
);

// Task development info
githubApiRouter.get("/tasks/:id/development", idParamValidator, safeControllerFunction(GithubController.getTaskDevelopment));

githubApiRouter.post(
  "/tasks/:id/branches",
  idParamValidator,
  safeControllerFunction(GithubController.createBranch),
);

export default githubApiRouter;
