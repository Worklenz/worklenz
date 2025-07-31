import express from "express";
import NotificationController from "../../controllers/notification-controller";

import ProfileSettingsController from "../../controllers/profile-settings-controller";
import ClientPortalController from "../../controllers/client-portal-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import profileSettingsBodyValidator from "../../middlewares/validators/profile-settings-body-validator";
import setupValidator from "../../middlewares/validators/setup-validator";
import teamSettingsBodyValidator from "../../middlewares/validators/team-settings-body-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const settingsApiRouter = express.Router();

settingsApiRouter.post("/setup", setupValidator, safeControllerFunction(ProfileSettingsController.setup));

settingsApiRouter.get("/notifications", safeControllerFunction(NotificationController.getSettings));
settingsApiRouter.put("/notifications", safeControllerFunction(NotificationController.updateSettings));

settingsApiRouter.get("/profile", safeControllerFunction(ProfileSettingsController.get));
settingsApiRouter.put("/profile", profileSettingsBodyValidator, safeControllerFunction(ProfileSettingsController.update));

settingsApiRouter.put("/team-name/:id", idParamValidator, teamSettingsBodyValidator, safeControllerFunction(ProfileSettingsController.update_team_name));

// Client Portal Settings (for organization-side management)
settingsApiRouter.get("/client-portal", safeControllerFunction(ClientPortalController.getSettings));
settingsApiRouter.put("/client-portal", safeControllerFunction(ClientPortalController.updateSettings));
settingsApiRouter.post("/client-portal/upload-logo", safeControllerFunction(ClientPortalController.uploadLogo));

export default settingsApiRouter;
