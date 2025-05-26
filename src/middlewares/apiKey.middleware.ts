import { Request, Response, NextFunction } from "express";
import App, { IApp } from "../models/app.model";

/**
 * Extends the base Express Request type to include optional `app` and `apiKey` properties.
 * `app` will be populated by the `apiKeyGuard` middleware upon successful API key validation.
 */
export type ApiKeyRequest = Request & {
  app?: IApp; // The validated Application document associated with the API key
  apiKey?: string; // The API key extracted from the request
};

/**
 * Middleware to guard routes that require an App-specific API key.
 * It performs the following steps:
 * 1. Extracts the API key from the request parameters (e.g., /:key/).
 * 2. Validates the API key by finding an active App with that key.
 * 3. Increments the App's total and daily request counters.
 * 4. Resets the App's daily request counter if a new day has started.
 * 5. Checks if the App has exceeded its daily request limit.
 * 6. If all checks pass, attaches the App object (`req.app`) and API key (`req.apiKey`) to the request object
 *    for use in subsequent middleware (like rate limiting) or route handlers.
 * 7. Calls `next()` to pass control to the next middleware/handler.
 * If any check fails, it sends an appropriate HTTP error response.
 */
export const apiKeyGuard = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract API key from URL parameter (e.g., from /exec/:key/some_path)
    // Assumes the API key is passed as a route parameter named 'key'.
    const key = (req as any).params?.key;

    if (!key) {
      return res.status(400).json({
        error: "Missing API key in URL path. Ensure the API key is provided in the format /<resource>/:apiKey/...",
      });
    }

    // Find the App associated with the API key.
    // Only consider active Apps.
    // Atomically increment the total and daily request counters for the App.
    const app = await App.findOneAndUpdate(
      {
        apiKey: key, // Match the API key from the request
        isActive: true, // Ensure the App is currently active
      },
      {
        $inc: {
          requests: 1, // Increment total lifetime requests
          dailyRequests: 1, // Increment requests for the current day
        },
      },
      {
        new: true, // Return the updated App document
      }
    );

    // If no App is found or it's inactive, the API key is invalid.
    if (!app) {
      return res.status(403).json({
        error: "Invalid or inactive API key.",
      });
    }

    // Reset the App's daily request counter if it's a new day.
    await app.resetDailyRequestsIfNeeded();

    // Check if the App has exceeded its daily request limit.
    // The limit is sourced from an environment variable, defaulting if not set.
    const dailyLimit = parseInt(process.env.DEFAULT_DAILY_REQUESTS || "10000");
    if (app.dailyRequests > dailyLimit) {
      // Note: The counter was already incremented. If strictness requires not counting
      // this request, the logic would need to be adjusted (e.g., check before incrementing,
      // but that introduces potential race conditions without more complex handling).
      return res.status(429).json({
        error: "Daily request limit exceeded. Please try again tomorrow.",
      });
    }

    // Attach the validated App object and the API key to the request object.
    // This allows subsequent middleware (e.g., rateLimitMiddleware) and route handlers
    // to access App-specific details like maxRps or chain configuration.
    req.app = app;
    req.apiKey = key;

    // The actual proxying to the target blockchain node is typically handled by another middleware
    // further down the chain, which would use req.app.chainName/chainId to determine the target URL.
    // This apiKeyGuard focuses solely on API key validation, request counting, and daily limits.

    next(); // API key is valid, proceed to the next middleware or route handler.
  } catch (error) {
    console.error("API Key middleware error:", error); // Log the error for server-side diagnostics.
    return res.status(500).json({
      error: "Internal server error. Please try again later.",
    });
  }
};

/**
 * Utility function to extract an API key from a request path.
 * Assumes the API key is the third segment in the path (e.g., /<type>/<apiKey>/...).
 * Example paths: "/exec/YOUR_API_KEY/...", "/cons/YOUR_API_KEY/..."
 * @param req The Express Request object.
 * @returns The extracted API key as a string, or null if not found or path format is incorrect.
 */
export const extractApiKey = (req: Request): string | null => {
  const pathParts = req.path.split("/"); // e.g., ['', 'exec', 'some-api-key', ...]
  // The API key is expected at index 2 if path starts with /resource/apiKey/...
  if (pathParts.length > 2 && pathParts[2]) {
    return pathParts[2];
  }
  return null;
};
