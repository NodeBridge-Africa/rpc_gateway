import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../models/user.model";

export type ApiKeyRequest = Request & {
  user?: IUser;
  apiKey?: string;
};

export const apiKeyGuard = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract API key from URL parameter (Express :key param)
    const key = (req as any).params?.key;

    if (!key) {
      return res.status(400).json({
        error: "Missing API key in URL path",
      });
    }

    // Find user by API key and increment request counter
    const user = await User.findOneAndUpdate(
      {
        apiKey: key,
        isActive: true,
      },
      {
        $inc: {
          requests: 1,
          dailyRequests: 1,
        },
      },
      {
        new: true,
      }
    );

    if (!user) {
      return res.status(403).json({
        error: "Invalid or inactive API key",
      });
    }

    // Reset daily requests if needed
    user.resetDailyRequestsIfNeeded();

    // Check daily limits
    const dailyLimit = parseInt(process.env.DEFAULT_DAILY_REQUESTS || "10000");
    if (user.dailyRequests > dailyLimit) {
      return res.status(429).json({
        error: "Daily request limit exceeded",
      });
    }

    // Attach user to request object for rate limiting
    req.user = user;
    req.apiKey = key;

    // The proxy middleware will handle path rewriting with pathRewrite option

    next();
  } catch (error) {
    console.error("API Key middleware error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const extractApiKey = (req: Request): string | null => {
  const pathParts = req.path.split("/");
  const [, , key] = pathParts; // Skip empty string and section (exec/cons)
  return key || null;
};
