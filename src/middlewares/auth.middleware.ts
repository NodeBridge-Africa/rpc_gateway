import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { errorResponse } from "../utils/responseHandler";

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(
        res,
        401,
        "Authorization header missing or invalid."
      );
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    const user = await User.findById(decoded.id);
    if (!user) {
      return errorResponse(res, 401, "User not found.");
    }
    req.userId = decoded.id;
    req.user = user; // Attach user to request for further use

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return errorResponse(res, 401, "Invalid token or authentication failed.");
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // Continue without setting userId
    }

    const token = authHeader.slice(7);

    if (!process.env.JWT_SECRET) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    const user = await User.findById(decoded.id);
    if (!user) {
      return errorResponse(res, 401, "User not found.");
    }
    req.userId = decoded.id;
    req.user = user; // Attach user to request for further use

    next();
  } catch (error) {
    // If token is invalid, continue without auth
    next();
  }
};
