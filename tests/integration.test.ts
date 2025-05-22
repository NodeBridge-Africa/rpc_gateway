import supertest from "supertest";
import { createTestApp } from "./helpers/testApp";
import User from "../src/models/user.model";
import { testUtils } from "./setup";
import nock from "nock";

const app = createTestApp();
const request = supertest(app);

describe("Integration Tests", () => {
  describe("Complete User Workflow", () => {
    it("should complete full user journey: register -> login -> make RPC calls", async () => {
      const userData = testUtils.generateTestUser();

      // 1. Register new user
      const registerResponse = await request
        .post("/auth/register")
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      const { token, apiKey } = registerResponse.body.data;

      // 2. Login with credentials
      const loginResponse = await request
        .post("/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body.data.apiKey).toBe(apiKey);

      // 3. Get account information
      const accountResponse = await request
        .get("/auth/account")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(accountResponse.body.data.user.email).toBe(userData.email);
      expect(accountResponse.body.data.endpoints.execution).toContain(apiKey);

      // 4. Mock Sepolia node and make RPC call
      nock("http://192.168.8.229:8545").post("/").reply(200, {
        jsonrpc: "2.0",
        id: 1,
        result: "0x1234567",
      });

      const rpcResponse = await request
        .post(`/exec/${apiKey}`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(200);

      expect(rpcResponse.body.result).toBe("0x1234567");

      // 5. Check usage statistics
      const usageResponse = await request
        .get("/auth/usage")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(usageResponse.body.data.totalRequests).toBe(1);
      expect(usageResponse.body.data.dailyRequests).toBe(1);

      // 6. Regenerate API key
      const newKeyResponse = await request
        .post("/auth/regenerate-api-key")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(newKeyResponse.body.data.apiKey).not.toBe(apiKey);

      // 7. Old API key should no longer work
      const oldKeyResponse = await request
        .post(`/exec/${apiKey}`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(403);

      expect(oldKeyResponse.body.error).toBe("Invalid or inactive API key");
    });

    it("should enforce rate limits across multiple requests", async () => {
      // Create user with very low rate limit
      const userData = testUtils.generateTestUser();
      const user = await User.create({
        ...userData,
        maxRps: 2, // 2 requests per second
      });

      // Mock multiple responses
      nock("http://192.168.8.229:8545")
        .post("/")
        .times(5)
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      // First 2 requests should succeed
      await request
        .post(`/exec/${user.apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      await request
        .post(`/exec/${user.apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 2 })
        .expect(200);

      // Third request should be rate limited
      const rateLimitedResponse = await request
        .post(`/exec/${user.apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 3 })
        .expect(429);

      expect(rateLimitedResponse.body.error).toBe("Rate limit exceeded");
      expect(rateLimitedResponse.headers["x-ratelimit-limit"]).toBe("2");
    });

    it("should track metrics across all endpoints", async () => {
      const userData = testUtils.generateTestUser();
      const registerResponse = await request
        .post("/auth/register")
        .send(userData)
        .expect(201);

      const { apiKey } = registerResponse.body.data;

      // Mock external services
      nock("http://192.168.8.229:8545")
        .post("/")
        .times(2)
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      nock("http://192.168.8.229:5052")
        .get("/eth/v1/beacon/headers")
        .reply(200, { data: { slot: "123456" } });

      // Make requests to different endpoints
      await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_getBalance", id: 2 })
        .expect(200);

      await request.get(`/cons/${apiKey}/eth/v1/beacon/headers`).expect(200);

      // Check metrics endpoint
      const metricsResponse = await request.get("/metrics").expect(200);

      const metricsText = metricsResponse.text;
      expect(metricsText).toContain("rpc_gateway_requests_total");
      expect(metricsText).toContain("rpc_gateway_request_duration_seconds");
    });

    it("should handle concurrent requests correctly", async () => {
      const userData = testUtils.generateTestUser();
      const user = await User.create({
        ...userData,
        maxRps: 10, // Reasonable rate limit
      });

      // Mock multiple concurrent responses
      nock("http://192.168.8.229:8545")
        .post("/")
        .times(5)
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      // Make 5 concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        request
          .post(`/exec/${user.apiKey}`)
          .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: i + 1 })
      );

      const responses = await Promise.all(promises);

      // All should succeed (within rate limit)
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Check final user state
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.requests).toBe(5);
      expect(updatedUser?.dailyRequests).toBe(5);
    });
  });

  describe("Error Handling Integration", () => {
    let user: any;
    let apiKey: string;

    beforeEach(async () => {
      const userData = testUtils.generateTestUser();
      user = await User.create(userData);
      apiKey = user.apiKey;
    });

    it("should handle downstream service failures gracefully", async () => {
      // Mock execution layer failure
      nock("http://192.168.8.229:8545").post("/").replyWithError("ECONNREFUSED");

      const response = await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(502);

      expect(response.body.error).toBe("Bad Gateway");
      expect(response.body.message).toBe(
        "Failed to connect to the Sepolia node"
      );

      // Request should still be counted
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.requests).toBe(1);
    });

    it("should handle invalid JSON-RPC requests", async () => {
      nock("http://192.168.8.229:8545")
        .post("/")
        .reply(400, {
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid Request" },
          id: null,
        });

      const response = await request
        .post(`/exec/${apiKey}`)
        .send({ invalid: "request" })
        .expect(400);

      expect(response.body.error.code).toBe(-32600);
    });

    it("should handle user deactivation during active session", async () => {
      // First request should work
      nock("http://192.168.8.229:8545")
        .post("/")
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      // Deactivate user
      await User.findByIdAndUpdate(user._id, { isActive: false });

      // Second request should fail
      const response = await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 2 })
        .expect(403);

      expect(response.body.error).toBe("Invalid or inactive API key");
    });
  });

  describe("Daily Limits Integration", () => {
    it("should enforce daily request limits", async () => {
      // Create user with low daily limit
      const userData = testUtils.generateTestUser();
      const user = await User.create({
        ...userData,
        maxRps: 100, // High RPS but low daily limit from env (1000)
      });

      // Simulate user having used 999 requests today
      await User.findByIdAndUpdate(user._id, {
        dailyRequests: 999,
        lastResetDate: new Date(),
      });

      // Mock response
      nock("http://192.168.8.229:8545")
        .post("/")
        .times(2)
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      // This should work (request 1000)
      await request
        .post(`/exec/${user.apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      // This should exceed daily limit (request 1001)
      const response = await request
        .post(`/exec/${user.apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 2 })
        .expect(429);

      expect(response.body.error).toBe("Daily request limit exceeded");
    });

    it("should reset daily limits at midnight", async () => {
      const userData = testUtils.generateTestUser();
      const user = await User.create({
        ...userData,
        dailyRequests: 500,
        lastResetDate: new Date("2023-01-01"), // Set to past date
      });

      // Mock response
      nock("http://192.168.8.229:8545")
        .post("/")
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      // This should work and reset the daily counter
      await request
        .post(`/exec/${user.apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      // Check that daily counter was reset
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.dailyRequests).toBe(1); // Reset to 1 (this request)
      expect(updatedUser?.lastResetDate.getDate()).toBe(new Date().getDate());
    });
  });

  describe("Performance Integration", () => {
    it("should handle burst of requests efficiently", async () => {
      const userData = testUtils.generateTestUser();
      const user = await User.create({
        ...userData,
        maxRps: 50, // Allow burst
      });

      // Mock many responses
      nock("http://192.168.8.229:8545")
        .post("/")
        .times(20)
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      const startTime = Date.now();

      // Make 20 requests in parallel
      const promises = Array.from({ length: 20 }, (_, i) =>
        request
          .post(`/exec/${user.apiKey}`)
          .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: i + 1 })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });
});
