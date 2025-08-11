import express from "express";
import AccountDeletionController from "../../controllers/account-deletion-controller";

const accountApiRouter = express.Router();

accountApiRouter.post("/deletion-request", AccountDeletionController.requestDeletion);
accountApiRouter.post("/cancel-deletion", AccountDeletionController.cancelDeletion);

export default accountApiRouter;