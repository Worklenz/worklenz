import express from "express";
import PlanRecommendationController from "../../controllers/plan-recommendation-controller";

const planRecommendationApiRouter = express.Router();

// Public endpoints (no authentication required)
planRecommendationApiRouter.get("/migration-info", (req, res) => {
  // Return general migration information
  res.json({
    migrationAvailable: true,
    supportedUserTypes: ['trial', 'free', 'custom_plan', 'appsumo'],
    supportedPlans: ['PRO_SMALL', 'BUSINESS_SMALL', 'PRO_LARGE', 'BUSINESS_LARGE', 'ENTERPRISE'],
    migrationWindow: {
      appSumo: '5 days',
      trial: '30 days',
      free: 'No limit',
      customPlan: 'Flexible'
    },
    contactInfo: {
      support: 'support@worklenz.com',
      migration: 'migration@worklenz.com'
    }
  });
});

// Organization-specific endpoints (authentication required)
planRecommendationApiRouter.get("/organizations/:organizationId/recommendations", 
  PlanRecommendationController.getRecommendations
);

planRecommendationApiRouter.get("/organizations/:organizationId/analytics", 
  PlanRecommendationController.getUserAnalytics
);

planRecommendationApiRouter.get("/organizations/:organizationId/appsumo", 
  PlanRecommendationController.getAppSumoOptions
);

planRecommendationApiRouter.get("/organizations/:organizationId/custom-plan", 
  PlanRecommendationController.getCustomPlanOptions
);

planRecommendationApiRouter.get("/organizations/:organizationId/cost-benefit-analysis", 
  PlanRecommendationController.getCostBenefitAnalysis
);

planRecommendationApiRouter.get("/organizations/:organizationId/plan-comparison", 
  PlanRecommendationController.getPlanComparison
);

planRecommendationApiRouter.get("/organizations/:organizationId/migration-preview", 
  PlanRecommendationController.getMigrationPreview
);

// Migration actions
planRecommendationApiRouter.post("/organizations/:organizationId/appsumo/migrate", 
  PlanRecommendationController.processAppSumoMigration
);

planRecommendationApiRouter.post("/organizations/:organizationId/custom-plan/mapping", 
  PlanRecommendationController.createCustomMapping
);

planRecommendationApiRouter.post("/organizations/:organizationId/grandfathered-discount", 
  PlanRecommendationController.generateGrandfatheredDiscount
);

// Admin endpoints (admin authentication required)
planRecommendationApiRouter.post("/admin/appsumo/send-notifications", 
  PlanRecommendationController.sendAppSumoNotifications
);

planRecommendationApiRouter.get("/admin/analytics", 
  PlanRecommendationController.getAdminAnalytics
);

export default planRecommendationApiRouter;