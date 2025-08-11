import express from "express";
import SupportController from "../../controllers/support-controller";

const supportApiRouter = express.Router();

supportApiRouter.post("/contact", SupportController.contactSupport);

export default supportApiRouter;