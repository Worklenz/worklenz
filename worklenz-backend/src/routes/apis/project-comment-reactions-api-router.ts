import express from "express";
import ProjectCommentReactionsController from "../../controllers/project-comment-reactions-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyProjectCommentAccess from "../../middlewares/verify-project-comment-access";

const projectCommentReactionsApiRouter = express.Router();

// Reactions
projectCommentReactionsApiRouter.post("/reactions/add", verifyProjectCommentAccess("body", "comment_id"), safeControllerFunction(ProjectCommentReactionsController.addReaction));
projectCommentReactionsApiRouter.post("/reactions/remove", verifyProjectCommentAccess("body", "comment_id"), safeControllerFunction(ProjectCommentReactionsController.removeReaction));
projectCommentReactionsApiRouter.get("/reactions/:comment_id", verifyProjectCommentAccess("params", "comment_id"), safeControllerFunction(ProjectCommentReactionsController.getReactions));

// Editing
projectCommentReactionsApiRouter.put("/edit", verifyProjectCommentAccess("body", "comment_id"), safeControllerFunction(ProjectCommentReactionsController.editComment));
projectCommentReactionsApiRouter.get("/edit-history/:comment_id", verifyProjectCommentAccess("params", "comment_id"), safeControllerFunction(ProjectCommentReactionsController.getEditHistory));

export default projectCommentReactionsApiRouter;
