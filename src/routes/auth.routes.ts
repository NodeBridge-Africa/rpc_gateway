import { Router } from "express";
import { body } from "express-validator";
import { auth } from "../middlewares/auth.middleware"; // Removed AuthRequest as it's used in controller
import { AuthController } from "../controllers/auth.controller";

const router = Router();
const authController = new AuthController();

// Validation rules
const registerValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

const loginValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").exists().withMessage("Password is required"),
];

const updatePasswordValidation = [
  body("currentPassword").exists().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
];

const updateEmailValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").exists().withMessage("Password is required for verification"),
];

// Register new user
router.post("/register", registerValidation, authController.registerUser);

// Login user
router.post("/login", loginValidation, authController.loginUser);

// Get user account info
router.get("/account", auth, authController.getAccountInfo);

// Get user info (alias for /account)
router.get("/me", auth, authController.getAccountInfo);

// Update password
router.patch("/password", auth, updatePasswordValidation, authController.updatePassword);

// Update email
router.patch("/email", auth, updateEmailValidation, authController.updateEmail);

// Export user data
router.get("/export", auth, authController.exportUserData);

export default router;
