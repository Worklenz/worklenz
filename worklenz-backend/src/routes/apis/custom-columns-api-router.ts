import express from "express";

import CustomcolumnsController from "../../controllers/custom-columns-controller";

const customColumnsApiRouter = express.Router();

customColumnsApiRouter.post("/", CustomcolumnsController.create);
customColumnsApiRouter.get("/", CustomcolumnsController.get);
customColumnsApiRouter.get("/project/:project_id/columns", CustomcolumnsController.getProjectColumns);
customColumnsApiRouter.get("/:id", CustomcolumnsController.getById);
customColumnsApiRouter.put("/:id", CustomcolumnsController.update);
customColumnsApiRouter.delete("/:id", CustomcolumnsController.deleteById);

export default customColumnsApiRouter;