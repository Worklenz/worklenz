import express from "express";
import rateLimit from "express-rate-limit";
import DiscordController from "../../controllers/discord-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const router = express.Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
router.get("/config", safeControllerFunction(DiscordController.getConfig));
router.put("/config", safeControllerFunction(DiscordController.saveConfig));
router.delete("/config", safeControllerFunction(DiscordController.deleteConfig));
router.get("/mappings", safeControllerFunction(DiscordController.getMappings));
router.post("/mappings", safeControllerFunction(DiscordController.saveMapping));
router.delete("/mappings/:id", safeControllerFunction(DiscordController.deleteMapping));

export default router;
