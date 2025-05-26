import { Request, Response, NextFunction } from 'express';
import { dynamicRateLimit, cleanupOldBuckets, getRateLimitStatus } from './rateLimit.middleware';
import { IApp } from '../models/app.model'; // Import IApp

// Define a type for our mock request that includes 'app'
interface MockRateLimitRequest extends Partial<Request> {
  app?: IApp;
}

// Mock timers for testing token refill
jest.useFakeTimers();

describe('Rate Limit Middleware', () => {
  let mockRequest: MockRateLimitRequest;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;
  let responseJson: any;
  let responseStatus: number;
  let responseHeaders: Record<string, string>;

  const mockAppApiKey = 'test-app-api-key';
  const mockAppMaxRps = 5; // 5 requests per second

  beforeEach(() => {
    jest.clearAllMocks();
    responseJson = {};
    responseStatus = 0;
    responseHeaders = {};

    mockRequest = {
      app: {
        apiKey: mockAppApiKey,
        maxRps: mockAppMaxRps,
        // Add other IApp fields if they become necessary for the middleware
      } as IApp, // Cast to IApp to satisfy the type, even if not all fields are used
    };

    mockNextFunction = jest.fn();
    mockResponse = {
      status: jest.fn().mockImplementation((status) => {
        responseStatus = status;
        return {
          json: jest.fn().mockImplementation((json) => {
            responseJson = json;
          }),
        };
      }),
      json: jest.fn().mockImplementation((json) => {
        responseJson = json;
      }),
      set: jest.fn().mockImplementation((headers: Record<string, string>) => {
        Object.assign(responseHeaders, headers);
      }),
    };

    // Clear any existing buckets (important for consistent tests)
    // This requires exporting the buckets or having a clearBuckets function.
    // For now, we assume each test runs with a fresh state or tests are designed for accumulation.
    // To properly clear, you'd need to modify rateLimit.middleware.ts to export buckets for testing
    // e.g., export const _buckets = buckets; and then _buckets = {}; here.
    // For this example, we'll rely on unique API keys per test or sequential testing.
    // Or, better yet, ensure cleanupOldBuckets is effective and testable.
    cleanupOldBuckets(); // Run cleanup to ensure a clean slate for tests if possible
});

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should allow request if tokens are available', () => {
    dynamicRateLimit(mockRequest as Request, mockResponse as Response, mockNextFunction);
    expect(mockNextFunction).toHaveBeenCalledTimes(1);
    expect(responseStatus).toBe(0); // No error status
    expect(parseInt(responseHeaders['X-RateLimit-Limit'])).toBe(mockAppMaxRps);
    expect(parseInt(responseHeaders['X-RateLimit-Remaining'])).toBe(mockAppMaxRps - 1);
  });

  it('should block request if rate limit is exceeded', () => {
    // Consume all tokens
    for (let i = 0; i < mockAppMaxRps; i++) {
      dynamicRateLimit(mockRequest as Request, mockResponse as Response, mockNextFunction);
    }
    mockNextFunction.mockClear(); // Clear previous calls for the next check

    // Next request should be blocked
    dynamicRateLimit(mockRequest as Request, mockResponse as Response, mockNextFunction);
    expect(mockNextFunction).not.toHaveBeenCalled();
    expect(responseStatus).toBe(429);
    expect(responseJson.error).toBe('Rate limit exceeded');
    expect(responseJson.limit).toBe(mockAppMaxRps);
    expect(responseJson.remaining).toBe(0); // Or Math.floor of a small negative if tokens go below 0 before check
  });

  it('should refill tokens over time', () => {
    // Consume some tokens
    for (let i = 0; i < 3; i++) {
      dynamicRateLimit(mockRequest as Request, mockResponse as Response, mockNextFunction);
    }
    const statusAfterConsumption = getRateLimitStatus(mockAppApiKey);
    expect(statusAfterConsumption?.tokensRemaining).toBe(mockAppMaxRps - 3);

    // Advance time by 1 second (should refill `maxRps` tokens)
    jest.advanceTimersByTime(1000);

    // Next request should be allowed as tokens should have refilled
    mockNextFunction.mockClear();
    dynamicRateLimit(mockRequest as Request, mockResponse as Response, mockNextFunction);
    expect(mockNextFunction).toHaveBeenCalledTimes(1);

    const statusAfterRefill = getRateLimitStatus(mockAppApiKey);
     // Tokens should be maxRps (refilled) - 1 (consumed)
    expect(statusAfterRefill?.tokensRemaining).toBe(mockAppMaxRps -1 );
  });

  it('should set appropriate X-RateLimit headers', () => {
    dynamicRateLimit(mockRequest as Request, mockResponse as Response, mockNextFunction);
    expect(responseHeaders['X-RateLimit-Limit']).toBe(mockAppMaxRps.toString());
    expect(responseHeaders['X-RateLimit-Remaining']).toBe((mockAppMaxRps - 1).toString());
    expect(responseHeaders['X-RateLimit-Reset']).toBeDefined();
    const resetTime = new Date(responseHeaders['X-RateLimit-Reset']).getTime();
    // Reset time should be roughly 1 second from now if all tokens were consumed
    // For one token consumed, it's (1 / maxRps) seconds from now
    const expectedResetTime = Date.now() + (1 / mockAppMaxRps) * 1000;
    expect(resetTime).toBeGreaterThanOrEqual(Date.now());
    expect(resetTime).toBeLessThanOrEqual(expectedResetTime + 100); // Allow small delta
  });

  it('should skip rate limiting if req.app is not set (though apiKeyGuard should prevent this)', () => {
    mockRequest.app = undefined;
    dynamicRateLimit(mockRequest as Request, mockResponse as Response, mockNextFunction);
    expect(mockNextFunction).toHaveBeenCalledTimes(1);
    expect(responseStatus).toBe(0); // No rate limiting applied
  });
  
  describe('cleanupOldBuckets', () => {
    it('should remove buckets that have not been refilled for longer than maxAge', () => {
        const oldApiKey = 'old-api-key';
        // Manually add an old bucket - this part is tricky without exposing 'buckets'
        // For a true test, you would need to:
        // 1. Call dynamicRateLimit with oldApiKey
        // 2. Advance time far into the future (e.g., 25 hours)
        // 3. Call cleanupOldBuckets
        // 4. Check if the bucket for oldApiKey is gone using getRateLimitStatus

        // Step 1: Create a bucket by using it
        const tempRequest = { app: { apiKey: oldApiKey, maxRps: 5 } as IApp };
        dynamicRateLimit(tempRequest as Request, mockResponse as Response, mockNextFunction);
        expect(getRateLimitStatus(oldApiKey)).not.toBeNull();


        // Step 2: Advance time by more than 24 hours
        jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours

        // Step 3: Call cleanup
        cleanupOldBuckets();

        // Step 4: Check if the bucket is removed
        expect(getRateLimitStatus(oldApiKey)).toBeNull();
    });

     it('should not remove active buckets', () => {
        // Use the main mockAppApiKey which is active in this test run
        dynamicRateLimit(mockRequest as Request, mockResponse as Response, mockNextFunction);
        expect(getRateLimitStatus(mockAppApiKey)).not.toBeNull();

        // Advance time but less than maxAge (e.g., 1 hour)
        jest.advanceTimersByTime(1 * 60 * 60 * 1000);
        cleanupOldBuckets();

        expect(getRateLimitStatus(mockAppApiKey)).not.toBeNull(); // Should still be there
    });
  });
   it('should handle multiple apps independently for rate limiting', () => {
    const app1Key = 'app1-key';
    const app1MaxRps = 2;
    const app2Key = 'app2-key';
    const app2MaxRps = 3;

    const reqApp1: MockRateLimitRequest = { app: { apiKey: app1Key, maxRps: app1MaxRps } as IApp };
    const reqApp2: MockRateLimitRequest = { app: { apiKey: app2Key, maxRps: app2MaxRps } as IApp };

    // Consume all tokens for App1
    for (let i = 0; i < app1MaxRps; i++) {
        dynamicRateLimit(reqApp1 as Request, mockResponse as Response, mockNextFunction);
    }
    mockNextFunction.mockClear();
    // Try App1 again - should be blocked
    dynamicRateLimit(reqApp1 as Request, mockResponse as Response, mockNextFunction);
    expect(mockNextFunction).not.toHaveBeenCalled();
    expect(responseStatus).toBe(429);

    // App2 should still work
    mockNextFunction.mockClear();
    mockResponse.status = jest.fn().mockReturnThis(); // Reset status mock for App2 call
    dynamicRateLimit(reqApp2 as Request, mockResponse as Response, mockNextFunction);
    expect(mockNextFunction).toHaveBeenCalledTimes(1);
    expect(responseStatus).not.toBe(429); // Check that App2 was NOT rate limited
  });
});
