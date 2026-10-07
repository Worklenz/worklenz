import express from "express";

import CustomcolumnsController from "../../controllers/custom-columns-controller";
import verifyProjectAccess from "../../middlewares/verify-project-access";
import verifyCustomColumnAccess from "../../middlewares/verify-custom-column-access";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import requireCustomColumnPermission from "../../middlewares/validators/require-custom-column-permission";

const customColumnsApiRouter = express.Router();

customColumnsApiRouter.post(
  "/",
  requireProjectPermission("customColumns", {
    sources: ["body.project_id", "query.current_project_id", "query.project_id"],
  }),
  CustomcolumnsController.create
);
customColumnsApiRouter.get("/", verifyProjectAccess("query", "project_id"), CustomcolumnsController.get);
customColumnsApiRouter.get(
  "/project/:project_id/columns",
  verifyProjectAccess("params", "project_id"),
  CustomcolumnsController.getProjectColumns
);
customColumnsApiRouter.get("/:id", verifyCustomColumnAccess("params", "id"), CustomcolumnsController.getById);
customColumnsApiRouter.put(
  "/:id",
  requireCustomColumnPermission("customColumns"),
  CustomcolumnsController.update
);
customColumnsApiRouter.delete(
  "/:id",
  requireCustomColumnPermission("customColumns"),
  CustomcolumnsController.deleteById
);

export default customColumnsApiRouter;
