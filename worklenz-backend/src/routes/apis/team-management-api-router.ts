import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import TeamManagementController from "../../controllers/team-management-controller";

const teamManagementApiRouter = express.Router();

teamManagementApiRouter.post("/assign-manager", teamOwnerOrAdminValidator, safeControllerFunction(TeamManagementController.assignManager));

export default teamManagementApiRouter;
