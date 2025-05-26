import { Router } from 'express';
import { body } from 'express-validator';
import { auth } from '../middlewares/auth.middleware';
import { AuthController } from '../controllers/auth.controller'; // Ensure this path is correct

const router = Router();
const authController = new AuthController();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists().withMessage('Password is required'),
];

// Register new user
router.post('/register', registerValidation, authController.registerUser);

// Login user
router.post('/login', loginValidation, authController.loginUser);

// Get user account info
router.get('/account', auth, authController.getAccountInfo);

// Get usage statistics
router.get('/usage', auth, authController.getUsageStats);


export default router;
