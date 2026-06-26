import express from "express";
import NotificationController from "../../controllers/notification-controller";

import ProfileSettingsController from "../../controllers/profile-settings-controller";
import OrgConfigurationController from "../../controllers/org-configuration-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import profileSettingsBodyValidator from "../../middlewares/validators/profile-settings-body-validator";
import setupValidator from "../../middlewares/validators/setup-validator";
import teamSettingsBodyValidator from "../../middlewares/validators/team-settings-body-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const settingsApiRouter = express.Router();

settingsApiRouter.post("/setup", setupValidator, safeControllerFunction(ProfileSettingsController.setup));

settingsApiRouter.get("/notifications", safeControllerFunction(NotificationController.getSettings));
settingsApiRouter.put("/notifications", safeControllerFunction(NotificationController.updateSettings));

settingsApiRouter.get("/profile", safeControllerFunction(ProfileSettingsController.get));
settingsApiRouter.put("/profile", profileSettingsBodyValidator, safeControllerFunction(ProfileSettingsController.update));

settingsApiRouter.put("/team-name/:id", idParamValidator, teamSettingsBodyValidator, safeControllerFunction(ProfileSettingsController.update_team_name));

settingsApiRouter.put("/mobile-app-banner-dismissed", safeControllerFunction(ProfileSettingsController.dismissMobileAppBanner));

// Client Portal Settings are a Business-plan feature — mounted by the EE settings-client-portal router.

// Organization Configuration Settings (Business Plan feature)
settingsApiRouter.get("/configuration", safeControllerFunction(OrgConfigurationController.get));
settingsApiRouter.put("/configuration", teamOwnerOrAdminValidator, safeControllerFunction(OrgConfigurationController.update));

export default settingsApiRouter;
