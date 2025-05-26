import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model'; // IUser can be removed if not directly used here
import { AuthRequest } from '../controllers/auth.controller'; // Import AuthRequest for consistency

/**
 * Middleware to authorize admin-only routes.
 * This middleware should run AFTER the standard `auth` middleware,
 * which populates `req.userId`.
 *
 * It checks if the authenticated user has administrative privileges.
 * - If `req.userId` is missing, it implies the `auth` middleware did not run or failed,
 *   so it returns a 401 Unauthorized.
 * - If the user is not found in the database, it returns a 404 Not Found.
 * - If the user is found but `user.isAdmin` is false, it returns a 403 Forbidden.
 * - If the user is an admin, it calls `next()` to proceed to the route handler.
 */
export const adminAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId; // userId is expected to be attached by a preceding auth middleware

    // Check if userId is present (i.e., if user is authenticated)
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in request. Authentication required.' });
    }

    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      // This case might indicate an issue if auth middleware passed but user is not found
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if the user has admin privileges
    if (!user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden: User is not an administrator. Access denied.' });
    }

    // User is authenticated and is an admin, proceed to the next middleware or route handler
    next();
  } catch (error) {
    // Log the error for server-side diagnostics
    console.error('Error in adminAuth middleware:', error);
    return res.status(500).json({ message: 'Internal server error during admin authorization.' });
  }
};
