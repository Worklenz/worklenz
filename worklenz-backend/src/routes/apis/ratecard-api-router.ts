import express from "express";

import RatecardController from "../../controllers/ratecard-controller";

const ratecardApiRouter = express.Router();

ratecardApiRouter.post("/", RatecardController.create);
ratecardApiRouter.get("/", RatecardController.get);
ratecardApiRouter.get("/:id", RatecardController.getById);
ratecardApiRouter.put("/:id", RatecardController.update);
ratecardApiRouter.delete("/:id", RatecardController.deleteById);

export default ratecardApiRouter;