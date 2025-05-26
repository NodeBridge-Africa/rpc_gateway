import { Request, Response, NextFunction } from "express";
// import { IUser } from "../models/user.model"; // Commented out as IUser is no longer used
import { IApp } from '../models/app.model'; // Added IApp import

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

type ApiKeyRequest = Request & {
  app?: IApp; // Changed from user?: IUser
};

// In-memory store for rate limiting buckets
const buckets: Record<string, RateLimitBucket> = {};

export const dynamicRateLimit = (
  req: ApiKeyRequest, // This type is now updated
  res: Response,
  next: NextFunction
) => {
  const app = req.app; // Get the app object from the request

  if (!app) {
    // No app found on request (e.g., if apiKeyGuard did not run or did not find an app)
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

// Cleanup old buckets periodically to prevent memory leaks
export const cleanupOldBuckets = () => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  Object.keys(buckets).forEach((appApiKey) => { // Parameter renamed for clarity
    const bucket = buckets[appApiKey];
    if (now - bucket.lastRefill > maxAge) {
      delete buckets[appApiKey];
    }
  });
};

// Run cleanup every hour
setInterval(cleanupOldBuckets, 60 * 60 * 1000);

// Note: The signature of getRateLimitStatus (userId: string) is now inconsistent 
// with the bucket keys (appApiKey: string). If this function is used externally,
// it will need to be updated or called with an appApiKey.
export const getRateLimitStatus = (apiKey: string) => { // Parameter renamed for clarity
  const bucket = buckets[apiKey];
  if (!bucket) return null;

  return {
    tokensRemaining: Math.floor(bucket.tokens),
    lastRefill: bucket.lastRefill,
  };
};
