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
          apiKey: user.apiKey,
          user: {
            id: user._id,
            email: user.email,
            apiKey: user.apiKey,
            maxRps: user.maxRps,
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
        apiKey: user.apiKey,
        user: {
          id: user._id,
          email: user.email,
          apiKey: user.apiKey,
          maxRps: user.maxRps,
          requests: user.requests,
          dailyRequests: user.dailyRequests,
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

    // Reset daily requests if needed
    user.resetDailyRequestsIfNeeded();
    await user.save();

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          apiKey: user.apiKey,
          maxRps: user.maxRps,
          requests: user.requests,
          dailyRequests: user.dailyRequests,
          lastResetDate: user.lastResetDate,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        endpoints: {
          execution: `${req.protocol}://${req.get("host")}/exec/${user.apiKey}`,
          consensus: `${req.protocol}://${req.get("host")}/cons/${user.apiKey}`,
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

// Regenerate API key
router.post("/regenerate-api-key", auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Generate new API key
    const newApiKey = user.generateNewApiKey();
    await user.save();

    res.json({
      success: true,
      data: {
        apiKey: newApiKey,
        endpoints: {
          execution: `${req.protocol}://${req.get("host")}/exec/${newApiKey}`,
          consensus: `${req.protocol}://${req.get("host")}/cons/${newApiKey}`,
        },
      },
    });
  } catch (error) {
    console.error("API key regeneration error:", error);
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

    const dailyLimit = parseInt(process.env.DEFAULT_DAILY_REQUESTS || "10000");

    res.json({
      success: true,
      data: {
        totalRequests: user.requests,
        dailyRequests: user.dailyRequests,
        dailyLimit: dailyLimit,
        rateLimitRps: user.maxRps,
        remainingDaily: Math.max(0, dailyLimit - user.dailyRequests),
        lastResetDate: user.lastResetDate,
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
