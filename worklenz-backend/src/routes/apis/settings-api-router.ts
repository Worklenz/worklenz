import express from "express";
import NotificationController from "../../controllers/notification-controller";

import ProfileSettingsController from "../../controllers/profile-settings-controller";
import ClientPortalSettingsController from "../../ee/controllers/client-portal/client-portal-settings-controller";
import OrgConfigurationController from "../../controllers/org-configuration-controller";
import CurrencyRatesController from "../../controllers/currency-rates-controller";

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

// Client Portal Settings (for organization-side management)
settingsApiRouter.get("/client-portal", safeControllerFunction(ClientPortalSettingsController.getSettings));
settingsApiRouter.put("/client-portal", safeControllerFunction(ClientPortalSettingsController.updateSettings));
settingsApiRouter.post("/client-portal/upload-logo", safeControllerFunction(ClientPortalSettingsController.uploadLogo));
settingsApiRouter.get("/client-portal/base-url", safeControllerFunction(ClientPortalSettingsController.getClientPortalBaseUrl));

// Organization Configuration Settings (Business Plan feature)
settingsApiRouter.get("/configuration", safeControllerFunction(OrgConfigurationController.get));
settingsApiRouter.put("/configuration", teamOwnerOrAdminValidator, safeControllerFunction(OrgConfigurationController.update));

// Currency exchange rates (cached proxy — no admin restriction)
settingsApiRouter.get("/currency-rates", safeControllerFunction(CurrencyRatesController.getRates));

export default settingsApiRouter;
