import express from "express";

import RatecardController from "../../controllers/ratecard-controller";
import { requireFeature } from "../../shared/entitlements/gates";

const ratecardApiRouter = express.Router();

// Rate cards are a Business Edition feature — gate every route server-side.
ratecardApiRouter.use(requireFeature("finance_module"));

ratecardApiRouter.post("/", RatecardController.create);
ratecardApiRouter.get("/", RatecardController.get);
ratecardApiRouter.get("/:id", RatecardController.getById);
ratecardApiRouter.put("/:id", RatecardController.update);
ratecardApiRouter.delete("/:id", RatecardController.deleteById);

export default ratecardApiRouter;