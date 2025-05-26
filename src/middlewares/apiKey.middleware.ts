import { Request, Response, NextFunction } from "express";
// import User, { IUser } from "../models/user.model"; // Commented out as per instructions
import App, { IApp } from "../models/app.model"; // Added IApp import

export type ApiKeyRequest = Request & {
  app?: IApp; // Changed from user?: IUser
  apiKey?: string;
};

export const apiKeyGuard = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract API key from URL parameter (Express :key param)
    const key = (req as any).params?.key; // Assuming key is still from URL param like /:key/

    if (!key) {
      return res.status(400).json({
        error: "Missing API key in URL path",
      });
    }

    // Find app by API key and increment request counter
    const app = await App.findOneAndUpdate(
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
        new: true, // Return the updated document
      }
    );

    if (!app) {
      return res.status(403).json({
        error: "Invalid or inactive API key",
      });
    }

    // Reset daily requests if needed (ensure this method exists on IApp)
    app.resetDailyRequestsIfNeeded();
    await app.save(); // Save changes from resetDailyRequestsIfNeeded if any

    // Check daily limits
    if (app.dailyRequests > app.dailyRequestsLimit) {
      return res.status(429).json({
        error: "Daily request limit exceeded for this app",
        // Optional: provide app.dailyRequestsLimit in the response for clarity
        // limit: app.dailyRequestsLimit 
      });
    }

    // Attach app to request object
    req.app = app; // Changed from req.user
    req.apiKey = key;

    // The proxy middleware will handle path rewriting.
    // It will need to use req.app.chainName or req.app.chainId to route correctly.
    next();
  } catch (error) {
    console.error("API Key middleware error:", error);
    res.status(500).json({
      error: "Internal server error in API key middleware",
    });
  }
};

// The extractApiKey function might need adjustment if the URL structure for API calls changes.
// For now, assuming it's still valid.
// export const extractApiKey = (req: Request): string | null => {
//   const pathParts = req.path.split("/");
//   // Example: /api/v1/proxy/<chainName>/:key/rpc-path -> key is at index 4 if base is /api/v1/proxy
//   // This needs to be robust based on the actual proxy route structure.
//   // If the key is always at a fixed position like /:key/, then (req as any).params?.key is better.
//   const key = (req as any).params?.key;
//   return key || null;
// };
