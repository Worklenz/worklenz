import express from "express";
import JobTitlesController from "../../controllers/job-titles-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import jobTitlesBodyValidator from "../../middlewares/validators/job-titles-body-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const jobTitlesApiRouter = express.Router();

jobTitlesApiRouter.post("/", teamOwnerOrAdminValidator, jobTitlesBodyValidator, safeControllerFunction(JobTitlesController.create));
jobTitlesApiRouter.get("/", safeControllerFunction(JobTitlesController.get));
jobTitlesApiRouter.get("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(JobTitlesController.getById));
jobTitlesApiRouter.put("/:id", teamOwnerOrAdminValidator, jobTitlesBodyValidator, idParamValidator, safeControllerFunction(JobTitlesController.update));
jobTitlesApiRouter.delete("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(JobTitlesController.deleteById));

export default jobTitlesApiRouter;
