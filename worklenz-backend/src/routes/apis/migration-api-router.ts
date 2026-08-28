import express from "express";
import MigrationController from "../../controllers/migration-controller";

const migrationApiRouter = express.Router();

// Migration eligibility and recommendations
migrationApiRouter.get("/eligibility", MigrationController.checkEligibility);
migrationApiRouter.get("/recommendations", MigrationController.getRecommendations);

// Migration preview and execution
migrationApiRouter.post("/preview", MigrationController.previewMigration);
migrationApiRouter.post("/execute", MigrationController.executeMigration);

// AppSumo specific endpoints
migrationApiRouter.get("/appsumo-discount", MigrationController.checkAppSumoDiscount);

export default migrationApiRouter;