import express from "express";
import ProjectCommentReactionsController from "../../controllers/project-comment-reactions-controller";

const projectCommentReactionsApiRouter = express.Router();

// Reactions
projectCommentReactionsApiRouter.post("/reactions/add", ProjectCommentReactionsController.addReaction);
projectCommentReactionsApiRouter.post("/reactions/remove", ProjectCommentReactionsController.removeReaction);
projectCommentReactionsApiRouter.get("/reactions/:comment_id", ProjectCommentReactionsController.getReactions);

// Editing
projectCommentReactionsApiRouter.put("/edit", ProjectCommentReactionsController.editComment);
projectCommentReactionsApiRouter.get("/edit-history/:comment_id", ProjectCommentReactionsController.getEditHistory);

export default projectCommentReactionsApiRouter;
