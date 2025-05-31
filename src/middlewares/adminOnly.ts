import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/responseHandler";

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isActive) {
    return errorResponse(res, 403, "Access denied. Admins only.");
  }
  next();
}
