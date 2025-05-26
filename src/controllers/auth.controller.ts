import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../models/user.model';
import { IUser } from '../models/user.model';

// Defines the structure of an authenticated request, adding userId.
export interface AuthRequest extends Request {
  userId?: string; // Injected by the auth middleware
}

/**
 * Controller for handling user authentication processes including
 * registration, login, and account information retrieval.
 */
export class AuthController {
  /**
   * Registers a new user.
   * Validates input, checks for existing users, creates a new user,
   * and returns a JWT token along with basic user information.
   * API keys are no longer handled at user registration; they are app-specific.
   */
  public async registerUser(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists with this email',
        });
      }

      // Create new user
      const user = await User.create({ email, password });

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d', // Use env var for expiration or default
      });

      // Return token and user information (excluding sensitive details like password)
      // User-specific API keys and rate limits are no longer part of the user model directly.
      return res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            appCount: user.appCount, // Number of apps created by the user
            isAdmin: user.isAdmin,   // Admin status
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({
        error: 'Internal server error during registration',
      });
    }
  }

  /**
   * Logs in an existing user.
   * Validates input, verifies credentials, and returns a JWT token
   * along with basic user information.
   */
  public async loginUser(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Find user by email, ensuring they are active
      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        return res.status(401).json({
          error: 'Invalid email or password', // Generic error for security
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid email or password', // Generic error
        });
      }

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
      });

      // Return token and basic user information.
      // User-specific API keys, rate limits, and detailed usage stats are no longer returned here.
      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            appCount: user.appCount,
            isAdmin: user.isAdmin,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        error: 'Internal server error during login',
      });
    }
  }

  /**
   * Retrieves account information for the authenticated user.
   * Excludes sensitive information.
   */
  public async getAccountInfo(req: AuthRequest, res: Response): Promise<Response> {
    try {
      // userId should be populated by the 'auth' middleware
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized: User ID not found in request' });
      }
      const user = await User.findById(req.userId).select('-password'); // Exclude password
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      // Return relevant user account details.
      // API keys and detailed usage are now app-specific.
      return res.json({
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
      console.error('Account info error:', error);
      return res.status(500).json({
        error: 'Internal server error while fetching account info',
      });
    }
  }

  /**
   * Retrieves usage statistics for the authenticated user.
   * This endpoint now clarifies that user-level stats are deprecated.
   */
  public async getUsageStats(req: AuthRequest, res: Response): Promise<Response> {
    try {
      // userId should be populated by the 'auth' middleware
      if (!req.userId) {
         return res.status(401).json({ error: 'Unauthorized: User ID not found in request' });
      }
      const user = await User.findById(req.userId).select('-password');
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      // User-level usage stats are deprecated.
      // Information about app-specific usage would be found via app-specific endpoints (if implemented).
      return res.json({
        success: true,
        data: {
          user: { // Basic user info for context
            id: user._id,
            email: user.email,
            appCount: user.appCount,
            isAdmin: user.isAdmin,
          },
          message: 'User-level usage statistics are deprecated. Please check usage per application.',
        },
      });
    } catch (error) {
      console.error('Usage stats error:', error);
      return res.status(500).json({
        error: 'Internal server error while fetching usage stats',
      });
    }
  }
}
