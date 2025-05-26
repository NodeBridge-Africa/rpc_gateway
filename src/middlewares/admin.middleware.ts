import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/user.model';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const adminAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in request' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden: User is not an administrator' });
    }

    next();
  } catch (error) {
    console.error('Error in adminAuth middleware:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
