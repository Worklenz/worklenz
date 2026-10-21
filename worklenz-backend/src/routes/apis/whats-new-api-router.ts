import express from "express";

import WhatsNewController from "../../controllers/whats-new-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const whatsNewApiRouter = express.Router();

whatsNewApiRouter.get("/current", safeControllerFunction(WhatsNewController.getCurrent));
whatsNewApiRouter.get("/latest", safeControllerFunction(WhatsNewController.getLatest));
whatsNewApiRouter.post("/dismiss", safeControllerFunction(WhatsNewController.dismiss));
whatsNewApiRouter.get("/releases/:id", safeControllerFunction(WhatsNewController.getById));

export default whatsNewApiRouter;
