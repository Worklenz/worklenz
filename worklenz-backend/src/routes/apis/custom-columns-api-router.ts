import express from "express";

import CustomcolumnsController from "../../controllers/custom-columns-controller";
import verifyProjectAccess, {verifyNonGuestProjectAccess} from "../../middlewares/verify-project-access";
import verifyCustomColumnAccess, {verifyNonGuestCustomColumnAccess} from "../../middlewares/verify-custom-column-access";

const customColumnsApiRouter = express.Router();

customColumnsApiRouter.post("/", verifyNonGuestProjectAccess('body', 'project_id'), CustomcolumnsController.create);
customColumnsApiRouter.get("/", verifyProjectAccess('query', 'project_id'), CustomcolumnsController.get);
customColumnsApiRouter.get("/project/:project_id/columns", verifyProjectAccess('params', 'project_id'), CustomcolumnsController.getProjectColumns);
customColumnsApiRouter.get("/:id", verifyCustomColumnAccess('params', 'id'), CustomcolumnsController.getById);
customColumnsApiRouter.put("/:id", verifyNonGuestCustomColumnAccess('params', 'id'), CustomcolumnsController.update);
customColumnsApiRouter.delete("/:id", verifyNonGuestCustomColumnAccess('params', 'id'), CustomcolumnsController.deleteById);

export default customColumnsApiRouter;