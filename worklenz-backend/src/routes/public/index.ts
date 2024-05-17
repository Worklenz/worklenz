import express from "express";
import ClientsController from "../../controllers/clients-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const public_router = express.Router();

public_router.post("/new-subscriber", safeControllerFunction(ClientsController.addSubscriber));

export default public_router;
