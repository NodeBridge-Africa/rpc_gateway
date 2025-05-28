import { Request, Response } from "express"; // Request is needed for non-AuthRequest routes initially
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { AuthRequest } from "../middlewares/auth.middleware";
import { validationResult } from "express-validator";

export class AuthController {
  public async registerUser(req: Request, res: Response): Promise<void> {
    // Changed to Request
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({
          error: "User already exists with this email",
        });
        return;
      }

      const user = await User.create({ email, password });

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
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
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

  public async loginUser(req: Request, res: Response): Promise<void> {
    // Changed to Request
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        res.status(401).json({
          error: "Invalid email or password",
        });
        return;
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        res.status(401).json({
          error: "Invalid email or password",
        });
        return;
      }

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
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }

  public async getAccountInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        res.status(404).json({
          error: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            isActive: user.isActive,
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
  }

  public async regenerateApiKey(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        res.status(404).json({
          error: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          message: "API key regeneration is now handled at the app level.",
        },
      });
    } catch (error) {
      console.error("API key regeneration error:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }

  public async getUsageStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        res.status(404).json({
          error: "User not found",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          message: "Usage stats are now handled at the app level.",
        },
      });
    } catch (error) {
      console.error("Usage stats error:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
}
