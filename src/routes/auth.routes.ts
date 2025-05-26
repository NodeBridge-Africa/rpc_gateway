import { Router } from 'express';
import { body } from 'express-validator';
import { auth } from '../middlewares/auth.middleware'; // JWT authentication middleware
import { AuthController } from '../controllers/auth.controller'; // Controller for authentication logic

const router = Router();
const authController = new AuthController();

// Input validation rules for user registration.
const registerValidationRules = [
  body('email').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
];

// Input validation rules for user login.
const loginValidationRules = [
  body('email').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
  body('password').exists().withMessage('Password is required.'),
];

/**
 * Route to register a new user.
 * Applies input validation before calling the controller.
 * POST /auth/register
 * Body: { email: string, password: string }
 */
router.post('/register', registerValidationRules, authController.registerUser);

/**
 * Route to log in an existing user.
 * Applies input validation before calling the controller.
 * POST /auth/login
 * Body: { email: string, password: string }
 */
router.post('/login', loginValidationRules, authController.loginUser);

/**
 * Route to get account information for the authenticated user.
 * Requires authentication (JWT token).
 * GET /auth/account
 */
router.get('/account', auth, authController.getAccountInfo);

/**
 * Route to get usage statistics for the authenticated user.
 * Requires authentication.
 * Note: User-level usage stats are deprecated in favor of per-app stats.
 * This endpoint now primarily returns basic user info and a deprecation message.
 * GET /auth/usage
 */
router.get('/usage', auth, authController.getUsageStats);

export default router;
