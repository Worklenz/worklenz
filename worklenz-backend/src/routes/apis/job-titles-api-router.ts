import express from "express";
import JobTitlesController from "../../controllers/job-titles-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import jobTitlesBodyValidator from "../../middlewares/validators/job-titles-body-validator";
import { manageOrganizationSettingsValidator } from "../../middlewares/validators/organization-permission-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const jobTitlesApiRouter = express.Router();

jobTitlesApiRouter.post("/", manageOrganizationSettingsValidator, jobTitlesBodyValidator, safeControllerFunction(JobTitlesController.create));
jobTitlesApiRouter.get("/", safeControllerFunction(JobTitlesController.get));
jobTitlesApiRouter.get("/:id", manageOrganizationSettingsValidator, idParamValidator, safeControllerFunction(JobTitlesController.getById));
jobTitlesApiRouter.put("/:id", manageOrganizationSettingsValidator, jobTitlesBodyValidator, idParamValidator, safeControllerFunction(JobTitlesController.update));
jobTitlesApiRouter.delete("/:id", manageOrganizationSettingsValidator, idParamValidator, safeControllerFunction(JobTitlesController.deleteById));

export default jobTitlesApiRouter;
