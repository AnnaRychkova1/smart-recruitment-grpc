import { Router } from "express";
import { handleSignup, handleSignin } from "../controllers/authController.js";

const router = Router();

router.get("/signup", (req, res) => {
  res.render("signup");
});
router.post("/api/signup", handleSignup);

router.get("/signin", (req, res) => {
  res.render("signin");
});
router.post("/api/signin", handleSignin);

export default router;
