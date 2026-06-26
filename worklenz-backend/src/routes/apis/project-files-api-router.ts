import express from "express";
import multer from "multer";

import ProjectFilesController from "../../controllers/project-files-controller";
import verifyProjectAccess from "../../middlewares/verify-project-access";
import projectFilesValidator, {
  MAX_PROJECT_FILE_SIZE_BYTES,
} from "../../middlewares/validators/project-files-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { ServerResponse } from "../../models/server-response";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROJECT_FILE_SIZE_BYTES },
});

const projectFilesApiRouter = express.Router({ mergeParams: true });

const handleUpload = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Max file size is 100 MB per file.",
          ).withTitle("Upload failed!"),
        );
    }

    return res
      .status(400)
      .send(
        new ServerResponse(
          false,
          null,
          "Unable to process the uploaded file",
        ).withTitle("Upload failed!"),
      );
  });
};

projectFilesApiRouter.get(
  "/",
  verifyProjectAccess("params", "projectId"),
  safeControllerFunction(ProjectFilesController.list),
);

projectFilesApiRouter.get(
  "/storage",
  verifyProjectAccess("params", "projectId"),
  safeControllerFunction(ProjectFilesController.storage),
);

projectFilesApiRouter.post(
  "/",
  verifyProjectAccess("params", "projectId"),
  handleUpload,
  projectFilesValidator,
  safeControllerFunction(ProjectFilesController.upload),
);

projectFilesApiRouter.get(
  "/:fileId/download",
  verifyProjectAccess("params", "projectId"),
  safeControllerFunction(ProjectFilesController.download),
);

projectFilesApiRouter.delete(
  "/:fileId",
  verifyProjectAccess("params", "projectId"),
  safeControllerFunction(ProjectFilesController.delete),
);

export default projectFilesApiRouter;
