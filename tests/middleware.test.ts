import supertest from "supertest";
import express from "express";
import { apiKeyGuard } from "../src/middlewares/apiKey.middleware";
import { dynamicRateLimit } from "../src/middlewares/rateLimit.middleware";
import { auth } from "../src/middlewares/auth.middleware";
import User from "../src/models/user.model";
import jwt from "jsonwebtoken";
import { testUtils } from "./setup";

describe("Middleware", () => {
  describe("API Key Middleware", () => {
    let app: express.Application;
    let testUser: any;
    let apiKey: string;

    beforeEach(async () => {
      // Create test user
      const userData = testUtils.generateTestUser();
      testUser = await User.create(userData);
      apiKey = testUser.apiKey;

      // Create test app
      app = express();
      app.use(express.json());

      // Test route with API key middleware
      app.use("/exec/:key", apiKeyGuard, (req: any, res) => {
        res.json({
          success: true,
          user: req.user?.email,
          apiKey: req.apiKey,
          url: req.url,
        });
      });
    });

    it("should allow request with valid API key", async () => {
      const response = await supertest(app)
        .post(`/exec/${apiKey}/test`)
        .send({ test: "data" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBe(testUser.email);
      expect(response.body.apiKey).toBe(apiKey);
      expect(response.body.url).toBe("/test");
    });

    it("should reject request with invalid API key", async () => {
      const response = await supertest(app)
        .post("/exec/invalid-key/test")
        .send({ test: "data" })
        .expect(403);

      expect(response.body.error).toBe("Invalid or inactive API key");
    });

    it("should reject request with missing API key", async () => {
      const response = await supertest(app)
        .post("/exec//test")
        .send({ test: "data" })
        .expect(400);

      expect(response.body.error).toBe("Missing API key in URL path");
    });

    it("should increment request counter", async () => {
      const initialRequests = testUser.requests;

      await supertest(app)
        .post(`/exec/${apiKey}/test`)
        .send({ test: "data" })
        .expect(200);

      // Refresh user from database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.requests).toBe(initialRequests + 1);
      expect(updatedUser?.dailyRequests).toBe(1);
    });

    it("should reject request for inactive user", async () => {
      // Deactivate user
      await User.findByIdAndUpdate(testUser._id, { isActive: false });

      const response = await supertest(app)
        .post(`/exec/${apiKey}/test`)
        .send({ test: "data" })
        .expect(403);

      expect(response.body.error).toBe("Invalid or inactive API key");
    });
  });

  describe("Rate Limiting Middleware", () => {
    let app: express.Application;
    let testUser: any;

    beforeEach(async () => {
      // Create test user with low rate limit for testing
      const userData = testUtils.generateTestUser();
      testUser = await User.create({
        ...userData,
        maxRps: 2, // 2 requests per second for testing
      });

      // Create test app
      app = express();
      app.use(express.json());

      // Add user to request for rate limiting
      app.use((req: any, res, next) => {
        req.user = testUser;
        next();
      });

      app.use(dynamicRateLimit);

      app.get("/test", (req, res) => {
        res.json({ success: true });
      });
    });

    it("should allow requests within rate limit", async () => {
      const response1 = await supertest(app).get("/test").expect(200);

      const response2 = await supertest(app).get("/test").expect(200);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);

      // Check rate limit headers
      expect(response1.header["x-ratelimit-limit"]).toBe("2");
      expect(response2.header["x-ratelimit-remaining"]).toBe("0");
    });

    it("should reject requests exceeding rate limit", async () => {
      // Make requests up to the limit
      await supertest(app).get("/test").expect(200);
      await supertest(app).get("/test").expect(200);

      // This should be rate limited
      const response = await supertest(app).get("/test").expect(429);

      expect(response.body.error).toBe("Rate limit exceeded");
      expect(response.body.limit).toBe(2);
    });

    it("should reset rate limit over time", async () => {
      // Consume all tokens
      await supertest(app).get("/test").expect(200);
      await supertest(app).get("/test").expect(200);
      await supertest(app).get("/test").expect(429);

      // Wait for token bucket to refill
      await testUtils.delay(1000);

      // Should be able to make requests again
      const response = await supertest(app).get("/test").expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should handle requests without user", async () => {
      // Create app without user in request
      const noUserApp = express();
      noUserApp.use(dynamicRateLimit);
      noUserApp.get("/test", (req, res) => {
        res.json({ success: true });
      });

      const response = await supertest(noUserApp).get("/test").expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe("Authentication Middleware", () => {
    let app: express.Application;
    let testUser: any;
    let validToken: string;

    beforeEach(async () => {
      // Create test user
      const userData = testUtils.generateTestUser();
      testUser = await User.create(userData);

      // Generate valid JWT token
      validToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET!, {
        expiresIn: "1h",
      });

      // Create test app
      app = express();
      app.use(express.json());
      app.use("/protected", auth);

      app.get("/protected/test", (req: any, res) => {
        res.json({
          success: true,
          userId: req.userId,
        });
      });
    });

    it("should allow request with valid token", async () => {
      const response = await supertest(app)
        .get("/protected/test")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe(testUser._id.toString());
    });

    it("should reject request without token", async () => {
      const response = await supertest(app).get("/protected/test").expect(401);

      expect(response.body.error).toBe(
        "Access denied. No valid token provided."
      );
    });

    it("should reject request with invalid token", async () => {
      const response = await supertest(app)
        .get("/protected/test")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.error).toBe("Invalid token.");
    });

    it("should reject request with malformed authorization header", async () => {
      const response = await supertest(app)
        .get("/protected/test")
        .set("Authorization", "InvalidFormat token")
        .expect(401);

      expect(response.body.error).toBe(
        "Access denied. No valid token provided."
      );
    });

    it("should reject expired token", async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { id: testUser._id },
        process.env.JWT_SECRET!,
        { expiresIn: "-1h" } // Already expired
      );

      const response = await supertest(app)
        .get("/protected/test")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBe("Invalid token.");
    });
  });
});
