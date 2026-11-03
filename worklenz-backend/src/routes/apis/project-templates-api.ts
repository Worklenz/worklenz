import express from "express";
import ProjectTemplatesController from "../../controllers/project-templates/pt-templates-controller";
import OnboardingController from "../../controllers/onboarding-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import requireCreateFromTemplates from "../../middlewares/validators/require-create-from-templates";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
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
  requireCreateFromTemplates,
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
  requireProjectPermission("saveAsTemplate", {
    sources: ["body.project_id", "query.current_project_id"],
  }),
  safeControllerFunction(ProjectTemplatesController.createCustomTemplate)
);
/** Copy & Customize — create custom from built-in (must be before :id routes) */
projectTemplatesApiRouter.post(
  "/custom-template/from-worklenz",
  safeControllerFunction(ProjectTemplatesController.createCustomFromWorklenzTemplate)
);
projectTemplatesApiRouter.get(
  "/custom-templates",
  safeControllerFunction(ProjectTemplatesController.getCustomTemplates)
);

projectTemplatesApiRouter.get(
  "/custom-template/:id",
  safeControllerFunction(ProjectTemplatesController.getCustomTemplateById)
);

projectTemplatesApiRouter.post(
  "/import-custom-template",
  requireCreateFromTemplates,
  safeControllerFunction(ProjectTemplatesController.importCustomTemplate)
);

projectTemplatesApiRouter.post(
  "/custom-template/:id/duplicate",
  idParamValidator,
  safeControllerFunction(ProjectTemplatesController.duplicateCustomTemplate)
);

projectTemplatesApiRouter.delete(
  "/custom-template/:id",
  safeControllerFunction(ProjectTemplatesController.deleteCustomTemplate)
);
/** Name-only rename (legacy) */
projectTemplatesApiRouter.patch(
  "/custom-template/:id",
  safeControllerFunction(ProjectTemplatesController.renameCustomTemplate)
);
/** Full definition overwrite (Edit) */
projectTemplatesApiRouter.put(
  "/custom-template/:id",
  idParamValidator,
  safeControllerFunction(ProjectTemplatesController.updateCustomTemplateDefinition)
);
projectTemplatesApiRouter.patch(
  "/custom-template/:id/scope",
  idParamValidator,
  teamOwnerOrAdminValidator,
  safeControllerFunction(ProjectTemplatesController.updateCustomTemplateScope)
);

export default projectTemplatesApiRouter;
