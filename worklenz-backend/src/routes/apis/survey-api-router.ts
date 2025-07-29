import express from "express";
import SurveyController from "../../controllers/survey-controller";
import surveySubmissionValidator from "../../middlewares/validators/survey-submission-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const surveyApiRouter = express.Router();

// Get account setup survey with questions
surveyApiRouter.get("/account-setup", safeControllerFunction(SurveyController.getAccountSetupSurvey));

// Check if user has completed account setup survey
surveyApiRouter.get("/account-setup/status", safeControllerFunction(SurveyController.checkAccountSetupSurveyStatus));

// Submit survey response
surveyApiRouter.post("/responses", surveySubmissionValidator, safeControllerFunction(SurveyController.submitSurveyResponse));

// Get user's survey response for a specific survey
surveyApiRouter.get("/responses/:survey_id", safeControllerFunction(SurveyController.getUserSurveyResponse));

export default surveyApiRouter;