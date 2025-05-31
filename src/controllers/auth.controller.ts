import { Request, Response } from "express"; // Request is needed for non-Request routes initially
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { validationResult } from "express-validator";
import { errorResponse, successResponse } from "../utils/responseHandler";

export class AuthController {
  public async registerUser(req: Request, res: Response): Promise<void> {
    // Changed to Request
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errorResponse(res, 400, {
          error: "Validation failed",
          details: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        errorResponse(res, 409, {
          error: "Email is already registered",
        });
        return;
      }

      const user = await User.create({ email, password, isAdmin: true });

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
            isAdmin: user.isAdmin,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      errorResponse(res, 500, {
        error: "Internal server error",
      });
    }
  }

  public async loginUser(req: Request, res: Response): Promise<void> {
    // Changed to Request
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errorResponse(res, 400, {
          error: "Validation failed",
          details: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        errorResponse(res, 401, {
          error: "Invalid email or password",
        });
        return;
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        errorResponse(res, 401, {
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
            isAdmin: user.isAdmin,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      errorResponse(res, 500, {
        error: "Internal server error",
      });
    }
  }

  public async getAccountInfo(req: Request, res: Response): Promise<void> {
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
      errorResponse(res, 500, {
        error: "Internal server error",
      });
    }
  }

  public async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errorResponse(res, 400, {
          error: "Validation failed",
          details: errors.array(),
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.userId);
      if (!user) {
        errorResponse(res, 404, {
          error: "User not found",
        });
        return;
      }

      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        errorResponse(res, 401, {
          error: "Current password is incorrect",
        });
        return;
      }

      user.password = newPassword;
      await user.save();

      successResponse(res, 200, {
        success: true,
        message: "Password updated successfully",
        data: user,
      });
    } catch (error) {
      console.error("Update password error:", error);
      errorResponse(res, 500, {
        error: "Internal server error",
      });
    }
  }

  public async updateEmail(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errorResponse(res, 400, {
          error: "Validation failed",
          details: errors.array(),
        });
        return;
      }

      const { email, password } = req.body;

      const user = await User.findById(req.userId);
      if (!user) {
        errorResponse(res, 404, {
          error: "User not found",
        });
        return;
      }

      // Verify password before allowing email change
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        errorResponse(res, 401, {
          error: "Password is incorrect",
        });
        return;
      }

      // Check if new email is already in use
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.userId },
      });
      if (existingUser) {
        errorResponse(res, 409, {
          error: "Email is already in use by another account",
        });
        return;
      }

      user.email = email;
      await user.save();

      successResponse(res, 200, {
        success: true,
        data: {
          message: "Email updated successfully",
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
      console.error("Update email error:", error);
      errorResponse(res, 500, {
        error: "Internal server error",
      });
    }
  }

  public async exportUserData(req: Request, res: Response): Promise<void> {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        errorResponse(res, 404, {
          error: "User not found",
        });
        return;
      }

      // Get all user apps
      const App = require("../models/app.model").default;
      const apps = await App.find({ userId: req.userId });

      const exportData = {
        user: {
          id: user._id,
          email: user.email,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        apps: apps.map((app: any) => ({
          id: app._id,
          name: app.name,
          description: app.description,
          chainName: app.chainName,
          chainId: app.chainId,
          isActive: app.isActive,
          requests: app.requests,
          dailyRequests: app.dailyRequests,
          maxRps: app.maxRps,
          dailyRequestsLimit: app.dailyRequestsLimit,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
        })),
        exportDate: new Date().toISOString(),
      };

      successResponse(res, 200, {
        success: true,
        data: exportData,
      });
    } catch (error) {
      console.error("Export user data error:", error);

      errorResponse(res, 500, {
        error: "Internal server error",
      });
    }
  }
}
