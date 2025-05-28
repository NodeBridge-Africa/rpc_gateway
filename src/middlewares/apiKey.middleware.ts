import { Request, Response, NextFunction } from "express";
// import User, { IUser } from "../models/user.model"; // Commented out as per instructions
import App, { IApp } from "../models/app.model"; // Added IApp import

export type ApiKeyRequest = Request & {
  app?: IApp;
  apiKey?: string;
};

/**
 * Express middleware to guard routes based on API key.
 * It performs the following actions:
 * 1. Extracts the API key from the request parameters (`req.params.key`).
 * 2. Finds an active application (`App`) matching the API key.
 * 3. If found, increments the app's total and daily request counters.
 * 4. Resets the app's daily request counter if a new day has started.
 * 5. Checks if the app has exceeded its `dailyRequestsLimit`.
 * 6. If all checks pass, attaches the `app` object and `apiKey` to the request object (`req.app`, `req.apiKey`).
 * 7. Calls `next()` to pass control to the next middleware or route handler.
 *
 * Rejects with appropriate HTTP status codes for missing key, invalid/inactive key, or exceeded daily limit.
 * @param req {AuthenticatedRequest} Express request object, augmented with `app` and `apiKey` properties.
 * @param res {Response} Express response object.
 * @param next {NextFunction} Express next middleware function.
 */
export const apiKeyGuard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const key = (req as any).params?.key;
    const requestedChain = (req as any).params?.chain?.toLowerCase();

    if (!key) {
      return res.status(400).json({
        error: "Missing API key in URL path",
      });
    }

    if (!requestedChain) {
      return res.status(400).json({
        error: "Missing chain in URL path",
      });
    }

    const app = await App.findOne({
      apiKey: key,
      isActive: true,
    });

    if (!app) {
      return res.status(403).json({
        error: "Invalid or inactive API key",
      });
    }

    // Check if the app is configured for the requested chain
    if (app.chainName.toLowerCase() !== requestedChain) {
      return res.status(403).json({
        error: `API key is not valid for chain '${requestedChain}'`,
        expectedChain: app.chainName,
      });
    }

    // Atomically increment total requests and handle daily requests based on reset status
    const didReset = app.resetDailyRequestsIfNeeded();

    let finalUpdatedApp;
    if (didReset) {
      // If reset, set dailyRequests to 1 and increment total requests
      // We also need to save the reset lastResetDate
      app.dailyRequests = 1;
      app.requests += 1;
      app.lastResetDate = new Date(); // Ensure lastResetDate is updated before save
      await app.save();
      finalUpdatedApp = app;
    } else {
      // If not reset, just increment both counters atomically
      finalUpdatedApp = await App.findOneAndUpdate(
        { apiKey: key, isActive: true, chainName: app.chainName },
        { $inc: { requests: 1, dailyRequests: 1 } },
        { new: true }
      );
    }

    if (!finalUpdatedApp) {
      console.error(
        "Failed to increment app counters after successful API key and chain validation."
      );
      return res.status(500).json({
        error: "Internal server error during request count update.",
      });
    }

    if (finalUpdatedApp.dailyRequests > finalUpdatedApp.dailyRequestsLimit) {
      return res.status(429).json({
        error: "Daily request limit exceeded for this app",
      });
    }

    // Attach app and apiKey to request object using 'any' to avoid complex type issues here.
    // Downstream middlewares/handlers should assert types if they need specific properties.
    (req as any).app = finalUpdatedApp;
    (req as any).apiKey = key;

    next();
  } catch (error) {
    console.error("API Key middleware error:", error);
    res.status(500).json({
      error: "Internal server error in API key middleware",
    });
  }
};
