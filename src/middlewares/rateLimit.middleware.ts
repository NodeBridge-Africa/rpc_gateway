import { Request, Response, NextFunction } from "express";
import { IApp } from "../models/app.model"; // Import IApp

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

type ApiKeyRequest = Request & {
  app?: IApp; // Changed from user to app
};

// In-memory store for rate limiting buckets
const buckets: Record<string, RateLimitBucket> = {};

export const dynamicRateLimit = (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  const app = req.app; // Use req.app

  if (!app) {
    return next(); // No app found, skip rate limiting (should be caught by apiKeyGuard)
  }

  const appApiKey = app.apiKey; // Use app.apiKey as the bucket key
  const now = Date.now();
  const maxRps = app.maxRps || 20; // Use app.maxRps

  // Get or create bucket for this app
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
      error: "Rate limit exceeded",
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

  Object.keys(buckets).forEach((apiKey) => { // Changed userId to apiKey
    const bucket = buckets[apiKey];
    if (now - bucket.lastRefill > maxAge) {
      delete buckets[apiKey];
    }
  });
};

// Run cleanup every hour
setInterval(cleanupOldBuckets, 60 * 60 * 1000);

export const getRateLimitStatus = (apiKey: string) => { // Changed userId to apiKey
  const bucket = buckets[apiKey];
  if (!bucket) return null;

  return {
    tokensRemaining: Math.floor(bucket.tokens),
    lastRefill: bucket.lastRefill,
  };
};
