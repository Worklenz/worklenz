import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import DigestPreferencesController from "../../controllers/digest-preferences-controller";

const digestApiRouter = express.Router();

digestApiRouter.get("/preferences", safeControllerFunction(DigestPreferencesController.getPreferences));
digestApiRouter.put("/preferences", safeControllerFunction(DigestPreferencesController.updatePreferences));

export default digestApiRouter;
