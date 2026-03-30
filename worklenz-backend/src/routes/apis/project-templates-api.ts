import express from "express";
import ProjectTemplatesController from "../../controllers/project-templates/pt-templates-controller";
import OnboardingController from "../../controllers/onboarding-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectTemplatesApiRouter = express.Router();

projectTemplatesApiRouter.get(
  "/create",
  safeControllerFunction(ProjectTemplatesController.createTemplates)
);
projectTemplatesApiRouter.post(
  "/setup",
  safeControllerFunction(OnboardingController.setupAccountFromTemplate)
);

// worklenz templates
projectTemplatesApiRouter.post(
  "/import-template",
  safeControllerFunction(ProjectTemplatesController.importTemplates)
);

projectTemplatesApiRouter.get(
  "/worklenz-templates",
  safeControllerFunction(ProjectTemplatesController.getTemplates)
);
projectTemplatesApiRouter.get(
  "/worklenz-templates/:id",
  safeControllerFunction(ProjectTemplatesController.getTemplateById)
);

// custom templates
projectTemplatesApiRouter.post(
  "/custom-template",
  safeControllerFunction(ProjectTemplatesController.createCustomTemplate)
);
projectTemplatesApiRouter.get(
  "/custom-templates",
  safeControllerFunction(ProjectTemplatesController.getCustomTemplates)
);

projectTemplatesApiRouter.post(
  "/import-custom-template",
  safeControllerFunction(ProjectTemplatesController.importCustomTemplate)
);

projectTemplatesApiRouter.delete(
  "/custom-template/:id",
  safeControllerFunction(ProjectTemplatesController.deleteCustomTemplate)
);
projectTemplatesApiRouter.patch(
  "/custom-template/:id",
  safeControllerFunction(ProjectTemplatesController.renameCustomTemplate)
);

export default projectTemplatesApiRouter;
