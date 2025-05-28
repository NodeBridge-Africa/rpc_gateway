import { Request, Response, NextFunction } from "express";
// import { IUser } from "../models/user.model"; // Commented out as IUser is no longer used
import { IApp } from "../models/app.model"; // Added IApp import

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

type ApiKeyRequest = Request & {
  app?: IApp; // Changed from user?: IUser
};

// In-memory store for rate limiting buckets
const buckets: Record<string, RateLimitBucket> = {};

/**
 * Express middleware for dynamic rate limiting based on the application's `maxRps` setting.
 * It uses a token bucket algorithm to control the request rate.
 * 1. Retrieves the `app` object attached to the request (expected to be set by `apiKeyGuard`).
 * 2. If no `app` is found, it skips rate limiting (assuming another middleware handles authentication).
 * 3. Uses the `app.apiKey` as a unique key for the rate limit bucket.
 * 4. Retrieves or creates a token bucket for the app, using `app.maxRps`.
 * 5. Refills tokens based on elapsed time and `app.maxRps`.
 * 6. If tokens are available, consumes one and sets rate limit headers (`X-RateLimit-Limit`,
 *    `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
 * 7. If no tokens are available, rejects the request with a 429 status code.
 *
 * @param req {ApiKeyRequest} Express request object, augmented with `app` property.
 * @param res {Response} Express response object.
 * @param next {NextFunction} Express next middleware function.
 */
export const dynamicRateLimit = (
  req: ApiKeyRequest, // This type is now updated
  res: Response,
  next: NextFunction
) => {
  const app = req.app; // Get the app object from the request

  if (!app) {
    // No app found on request (e.g., if apiKeyGuard did not run or did not find an app).
    // Depending on desired behavior, could skip rate limiting or return an error
    // For now, let's skip, assuming other middleware handles auth.
    return next();
  }

  const appApiKey = app.apiKey; // Use API key as the unique identifier for the bucket
  const now = Date.now();
  const maxRps = app.maxRps; // Use maxRps from the app object

  // Get or create bucket for this app API key
  let bucket = buckets[appApiKey];
  if (!bucket) {
    bucket = buckets[appApiKey] = {
      tokens: maxRps,
      lastRefill: now,
    };
  }

  // Calculate tokens to add based on time elapsed
  const timeDelta = (now - bucket.lastRefill) / 1000; // Convert to seconds
  const tokensToAdd = timeDelta * maxRps;

  // Refill bucket but don't exceed capacity
  bucket.tokens = Math.min(maxRps, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  // Check if we have tokens available
  if (bucket.tokens < 1) {
    return res.status(429).json({
      error: "Rate limit exceeded for this API key",
      retryAfter: Math.ceil((1 - bucket.tokens) / maxRps),
      limit: maxRps,
      remaining: Math.floor(bucket.tokens),
    });
  }

  // Consume a token
  bucket.tokens -= 1;

  // Add rate limit headers
  res.set({
    "X-RateLimit-Limit": maxRps.toString(),
    "X-RateLimit-Remaining": Math.floor(bucket.tokens).toString(),
    "X-RateLimit-Reset": new Date(
      now + ((maxRps - bucket.tokens) / maxRps) * 1000
    ).toISOString(),
  });

  next();
};

/**
 * Periodically cleans up old rate limit buckets from the in-memory store.
 * This prevents memory leaks by removing buckets that haven't been refilled
 * for a specified maximum age (currently 24 hours).
 */
export const cleanupOldBuckets = () => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours: Max age for a bucket before being considered stale

  Object.keys(buckets).forEach((appApiKey) => {
    const bucket = buckets[appApiKey];
    // If the bucket hasn't been refilled in `maxAge` milliseconds, delete it.
    if (now - bucket.lastRefill > maxAge) {
      delete buckets[appApiKey];
    }
  });
};

// Schedule the cleanup function to run every hour.
export const cleanupInterval = setInterval(cleanupOldBuckets, 60 * 60 * 1000);

/**
 * Retrieves the current rate limit status for a given API key.
 * Primarily for debugging or potential admin monitoring.
 * @param apiKey The API key to check the rate limit status for.
 * @returns An object with `tokensRemaining` and `lastRefill` timestamp, or null if no bucket exists.
 */
export const getRateLimitStatus = (apiKey: string) => {
  const bucket = buckets[apiKey];
  if (!bucket) return null;

  return {
    tokensRemaining: Math.floor(bucket.tokens),
    lastRefill: bucket.lastRefill,
  };
};

// Export function to stop the cleanup interval (useful for tests)
export const stopCleanupInterval = () => {
  clearInterval(cleanupInterval);
};
