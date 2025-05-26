import { Request, Response, NextFunction } from "express";
import { IApp } from "../models/app.model"; // Import IApp interface
import { ApiKeyRequest } from "./apiKey.middleware"; // Import the extended Request type

/**
 * Represents a token bucket for rate limiting.
 * `tokens`: Current number of available tokens.
 * `lastRefill`: Timestamp of the last token refill.
 */
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

// In-memory store for rate limiting buckets.
// Each key is an App's API key, and the value is its RateLimitBucket.
// Note: For distributed systems, an external store like Redis would be more suitable.
const buckets: Record<string, RateLimitBucket> = {};

/**
 * Middleware for dynamic rate limiting based on an App's configured `maxRps` (requests per second).
 * This middleware should run AFTER `apiKeyGuard` which populates `req.app`.
 * It uses a token bucket algorithm for each App's API key.
 */
export const dynamicRateLimit = (
  req: ApiKeyRequest, // Use ApiKeyRequest to ensure req.app is typed
  res: Response,
  next: NextFunction
) => {
  const app = req.app; // Get the App object attached by apiKeyGuard

  // If req.app is not populated (e.g., apiKeyGuard was skipped or failed silently),
  // skip rate limiting. This case should ideally be caught by apiKeyGuard itself.
  if (!app) {
    return next();
  }

  const appApiKey = app.apiKey; // Use the App's unique API key as the identifier for its bucket
  const now = Date.now();
  const maxRps = app.maxRps || 20; // Use the App's configured maxRps, or a default of 20.

  // Retrieve or create the token bucket for this specific App API key.
  let bucket = buckets[appApiKey];
  if (!bucket) {
    // Initialize a new bucket if one doesn't exist for this API key.
    bucket = buckets[appApiKey] = {
      tokens: maxRps, // Start with a full bucket of tokens
      lastRefill: now, // Record the current time as the last refill time
    };
  }

  // Calculate tokens to add based on time elapsed since the last refill.
  // This implements the "refill" part of the token bucket algorithm.
  const timeDeltaSeconds = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = timeDeltaSeconds * maxRps;

  // Add the calculated tokens, ensuring the bucket does not exceed its maximum capacity (maxRps).
  bucket.tokens = Math.min(maxRps, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now; // Update the last refill time to the current time.

  // Check if enough tokens are available to process the request.
  if (bucket.tokens < 1) {
    // Not enough tokens; the request is rate-limited.
    return res.status(429).json({ // HTTP 429 Too Many Requests
      error: "Rate limit exceeded. Too many requests.",
      retryAfter: Math.ceil((1 - bucket.tokens) / maxRps), // Suggest when to retry (in seconds)
      limit: maxRps, // Inform the client about their current limit
      remaining: Math.floor(bucket.tokens), // Inform about remaining tokens (can be < 0 if bursty)
    });
  }

  // Consume one token for the current request.
  bucket.tokens -= 1;

  // Set standard rate limit headers in the response.
  // These headers help clients understand their current rate limit status.
  res.set({
    "X-RateLimit-Limit": maxRps.toString(), // The maximum number of requests allowed per window
    "X-RateLimit-Remaining": Math.floor(bucket.tokens).toString(), // The number of requests remaining in the current window
    "X-RateLimit-Reset": new Date( // Approximate time when the limit will reset to full capacity
      now + ((maxRps - bucket.tokens) / maxRps) * 1000
    ).toISOString(),
  });

  next(); // Proceed to the next middleware or route handler.
};

/**
 * Periodically cleans up old rate limit buckets from the in-memory store
 * to prevent memory leaks from accumulating buckets for inactive API keys.
 */
export const cleanupOldBuckets = () => {
  const now = Date.now();
  const maxAgeMs = 24 * 60 * 60 * 1000; // Maximum age for a bucket (e.g., 24 hours)

  Object.keys(buckets).forEach((apiKey) => {
    const bucket = buckets[apiKey];
    // If a bucket hasn't been refilled (i.e., accessed) in `maxAgeMs`, remove it.
    if (now - bucket.lastRefill > maxAgeMs) {
      delete buckets[apiKey];
    }
  });
};

// Schedule cleanupOldBuckets to run periodically (e.g., every hour).
// This interval should be configurable or adjusted based on expected load and key churn.
setInterval(cleanupOldBuckets, 60 * 60 * 1000); // Run every hour

/**
 * Retrieves the current rate limit status for a given App API key.
 * Useful for debugging or potentially exposing status to users/admins.
 * @param apiKey The API key of the App.
 * @returns An object with `tokensRemaining` and `lastRefill` time, or null if no bucket exists.
 */
export const getRateLimitStatus = (apiKey: string): RateLimitBucket | null => {
  const bucket = buckets[apiKey];
  if (!bucket) return null;

  // Return a copy to prevent external modification of the bucket state
  return {
    tokens: Math.floor(bucket.tokens), // Return whole tokens for clarity
    lastRefill: bucket.lastRefill,
  };
};
