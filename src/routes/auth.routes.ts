import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import User from "../models/user.model";
import { auth, AuthRequest } from "../middlewares/auth.middleware";

const router = Router();

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

// Register new user
router.post(
  "/register",
  registerValidation,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          error: "User already exists with this email",
        });
      }

      // Create new user
      const user = await User.create({ email, password });

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
        expiresIn: "30d",
      });

      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            appCount: user.appCount,
            isAdmin: user.isAdmin,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

// Login user
router.post("/login", loginValidation, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
      expiresIn: "30d",
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          // appCount and other relevant user fields can be added here if needed upon login
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Get user account info
router.get("/account", auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          isActive: user.isActive,
          appCount: user.appCount,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Account info error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Get usage statistics
router.get("/usage", auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Note: User-level usage stats (totalRequests, dailyRequests, etc.) are removed.
    // Usage stats are now app-specific.
    // This route might be deprecated or changed to show aggregated app usage in the future.
    // For now, it returns basic user info without usage details.
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          appCount: user.appCount,
          isAdmin: user.isAdmin,
        },
        message: "User-level usage statistics are deprecated. Please check usage per application.",
      },
    });
  } catch (error) {
    console.error("Usage stats error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;
