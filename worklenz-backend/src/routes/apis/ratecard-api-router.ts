import express from "express";

import RatecardController from "../../controllers/ratecard-controller";
import { requireBusinessPlan } from "../../middlewares/subscription-middleware";

const ratecardApiRouter = express.Router();

// Rate cards are a Business Edition feature — gate every route server-side.
ratecardApiRouter.use(requireBusinessPlan);

ratecardApiRouter.post("/", RatecardController.create);
ratecardApiRouter.get("/", RatecardController.get);
ratecardApiRouter.get("/:id", RatecardController.getById);
ratecardApiRouter.put("/:id", RatecardController.update);
ratecardApiRouter.delete("/:id", RatecardController.deleteById);

export default ratecardApiRouter;