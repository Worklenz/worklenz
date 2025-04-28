import express from "express";
import ClientsController from "../../controllers/clients-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const public_router = express.Router();

public_router.post("/new-subscriber", safeControllerFunction(ClientsController.addSubscriber));
public_router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

export default public_router;
