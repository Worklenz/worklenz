import express from "express";
import UserTypeController from "../../controllers/user-type-controller";

const usersApiRouter = express.Router();

// User type management
usersApiRouter.get("/type", UserTypeController.getUserType);
usersApiRouter.put("/type", UserTypeController.updateUserType);
usersApiRouter.get("/type/history", UserTypeController.getUserTypeHistory);
usersApiRouter.post("/type/check-eligibility", UserTypeController.checkEligibility);

// Legacy plan information
usersApiRouter.get("/legacy-plan", UserTypeController.getLegacyPlan);

export default usersApiRouter;