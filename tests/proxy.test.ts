import supertest from "supertest";
import express from "express";
import { createTestApp } from "./helpers/testApp";
import User from "../src/models/user.model";
import { testUtils } from "./setup";
import nock from "nock";

const app = createTestApp();
const request = supertest(app);

describe("Proxy Routes", () => {
  let testUser: any;
  let apiKey: string;

  beforeEach(async () => {
    // Create test user
    const userData = testUtils.generateTestUser();
    testUser = await User.create({
      ...userData,
      maxRps: 100, // High rate limit for proxy tests
    });
    apiKey = testUser.apiKey;

    // Clean up any previous nock interceptors
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("Execution Layer Proxy (/exec)", () => {
    it("should proxy JSON-RPC requests to execution layer", async () => {
      // Mock the execution layer response
      const mockResponse = {
        jsonrpc: "2.0",
        id: 1,
        result: "0x12a05f200",
      };

      nock("http://192.168.8.229:8545").post("/").reply(200, mockResponse);

      const rpcRequest = {
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      };

      const response = await request
        .post(`/exec/${apiKey}`)
        .send(rpcRequest)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(response.headers["x-rpc-gateway"]).toBe("NodeBridge");
      expect(response.headers["x-endpoint-type"]).toBe("execution");
    });

    it("should handle execution layer errors", async () => {
      // Mock a connection error
      nock("http://192.168.8.229:8545")
        .post("/")
        .replyWithError("Connection refused");

      const rpcRequest = {
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      };

      const response = await request
        .post(`/exec/${apiKey}`)
        .send(rpcRequest)
        .expect(502);

      expect(response.body.error).toBe("Bad Gateway");
      expect(response.body.message).toBe(
        "Failed to connect to the Sepolia node"
      );
      expect(response.body.endpointType).toBe("execution");
    });

    it("should proxy requests with path parameters", async () => {
      nock("http://192.168.8.229:8545")
        .get("/some/path")
        .reply(200, { success: true });

      const response = await request
        .get(`/exec/${apiKey}/some/path`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should reject requests without valid API key", async () => {
      const rpcRequest = {
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      };

      const response = await request
        .post("/exec/invalid-key")
        .send(rpcRequest)
        .expect(403);

      expect(response.body.error).toBe("Invalid or inactive API key");
    });
  });

  describe("Consensus Layer Proxy (/cons)", () => {
    it("should proxy REST requests to consensus layer", async () => {
      const mockResponse = {
        data: {
          slot: "4636363",
          parent_root: "0x1234567890abcdef",
          state_root: "0xabcdef1234567890",
        },
      };

      nock("http://192.168.8.229:5052")
        .get("/eth/v1/beacon/headers")
        .reply(200, mockResponse);

      const response = await request
        .get(`/cons/${apiKey}/eth/v1/beacon/headers`)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(response.headers["x-rpc-gateway"]).toBe("NodeBridge");
      expect(response.headers["x-endpoint-type"]).toBe("consensus");
    });

    it("should handle consensus layer errors", async () => {
      nock("http://192.168.8.229:5052")
        .get("/eth/v1/beacon/headers")
        .replyWithError("Service unavailable");

      const response = await request
        .get(`/cons/${apiKey}/eth/v1/beacon/headers`)
        .expect(502);

      expect(response.body.error).toBe("Bad Gateway");
      expect(response.body.endpointType).toBe("consensus");
    });

    it("should proxy POST requests to consensus layer", async () => {
      const mockResponse = { success: true };
      const postData = { validator_index: 1234 };

      nock("http://192.168.8.229:5052")
        .post("/eth/v1/beacon/some_endpoint")
        .reply(200, mockResponse);

      const response = await request
        .post(`/cons/${apiKey}/eth/v1/beacon/some_endpoint`)
        .send(postData)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
    });

    it("should reject requests without valid API key", async () => {
      const response = await request
        .get("/cons/invalid-key/eth/v1/beacon/headers")
        .expect(403);

      expect(response.body.error).toBe("Invalid or inactive API key");
    });
  });

  describe("Request Tracking", () => {
    it("should increment user request counters", async () => {
      nock("http://192.168.8.229:8545").post("/").reply(200, { result: "success" });

      const initialRequests = testUser.requests;
      const initialDailyRequests = testUser.dailyRequests;

      await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      // Check that counters were incremented
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.requests).toBe(initialRequests + 1);
      expect(updatedUser?.dailyRequests).toBe(initialDailyRequests + 1);
    });

    it("should apply rate limiting to proxy requests", async () => {
      // Create user with very low rate limit
      const limitedUser = await User.create({
        ...testUtils.generateTestUser(),
        maxRps: 1,
      });

      nock("http://192.168.8.229:8545")
        .post("/")
        .times(3)
        .reply(200, { result: "success" });

      // First request should succeed
      await request
        .post(`/exec/${limitedUser.apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      // Second request should be rate limited
      const response = await request
        .post(`/exec/${limitedUser.apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 2 })
        .expect(429);

      expect(response.body.error).toBe("Rate limit exceeded");
    });
  });

  describe("Health Check", () => {
    it("should return health status for both endpoints", async () => {
      // Mock both endpoints as healthy
      nock("http://192.168.8.229:8545")
        .post("/")
        .reply(200, { jsonrpc: "2.0", result: "0x12345", id: 1 });

      nock("http://192.168.8.229:5052").get("/eth/v1/node/health").reply(200);

      const response = await request.get("/health").expect(200);

      expect(response.body.status).toBe("healthy");
      expect(response.body.checks.execution.status).toBe("healthy");
      expect(response.body.checks.consensus.status).toBe("healthy");
    });

    it("should return unhealthy status when endpoints are down", async () => {
      // Mock both endpoints as failing
      nock("http://192.168.8.229:8545")
        .post("/")
        .replyWithError("Connection refused");

      nock("http://192.168.8.229:5052")
        .get("/eth/v1/node/health")
        .replyWithError("Service unavailable");

      const response = await request.get("/health").expect(503);

      expect(response.body.status).toBe("unhealthy");
      expect(response.body.checks.execution.status).toBe("unhealthy");
      expect(response.body.checks.consensus.status).toBe("unhealthy");
    });
  });

  describe("Response Headers", () => {
    it("should add custom headers to proxy responses", async () => {
      nock("http://192.168.8.229:8545").post("/").reply(200, { result: "test" });

      const response = await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "test", id: 1 });

      expect(response.headers["x-rpc-gateway"]).toBe("NodeBridge");
      expect(response.headers["x-endpoint-type"]).toBe("execution");
      expect(response.headers["x-response-time"]).toBeDefined();
    });

    it("should include rate limit headers", async () => {
      nock("http://192.168.8.229:8545").post("/").reply(200, { result: "test" });

      const response = await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "test", id: 1 });

      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
      expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
      expect(response.headers["x-ratelimit-reset"]).toBeDefined();
    });
  });
});
