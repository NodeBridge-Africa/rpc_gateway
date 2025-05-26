import { Request, Response, NextFunction } from "express";
import { IUser } from "../models/user.model";

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

type ApiKeyRequest = Request & {
  user?: IUser;
};

// In-memory store for rate limiting buckets
const buckets: Record<string, RateLimitBucket> = {};

export const dynamicRateLimit = (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;

  if (!user) {
    return next(); // No user found, skip rate limiting
  }

  const userId = user._id.toString();
  const now = Date.now();
  const maxRps = user.maxRps || 20;

  // Get or create bucket for this user
  let bucket = buckets[userId];
  if (!bucket) {
    bucket = buckets[userId] = {
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

  Object.keys(buckets).forEach((userId) => {
    const bucket = buckets[userId];
    if (now - bucket.lastRefill > maxAge) {
      delete buckets[userId];
    }
  });
};

// Run cleanup every hour
setInterval(cleanupOldBuckets, 60 * 60 * 1000);

export const getRateLimitStatus = (userId: string) => {
  const bucket = buckets[userId];
  if (!bucket) return null;

  return {
    tokensRemaining: Math.floor(bucket.tokens),
    lastRefill: bucket.lastRefill,
  };
};
