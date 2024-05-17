import express from "express";
import IndexController from "../controllers/index-controller";
import safeControllerFunction from "../shared/safe-controller-function";

const router = express.Router({strict: false});

router.use(IndexController.use);

router.get("/", IndexController.worklenz);
router.get("/pricing", IndexController.pricing);
router.get("/privacy-policy", IndexController.privacyPolicy);
router.get("/terms-of-use", IndexController.termsOfUse);
router.get(["/session-expired", "/authenticate"], IndexController.redirectToLogin);
router.get("/auth/signup", safeControllerFunction(IndexController.signup));
router.get("/auth/login", safeControllerFunction(IndexController.login));
router.get(["/teams"], IndexController.admin);
router.get(["/auth", "/auth/**"], IndexController.auth);
router.get(["/worklenz", "/worklenz/**"], IndexController.worklenz);

export default router;
