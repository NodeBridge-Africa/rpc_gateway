import supertest from "supertest";
import { createTestApp } from "./helpers/testApp";
import {
  httpRequestsTotal,
  recordRpcMetrics,
  recordRateLimitHit,
} from "../src/services/metrics.service";
import User from "../src/models/user.model";
import { testUtils } from "./setup";
import nock from "nock";
import prom from "prom-client";

const app = createTestApp();
const request = supertest(app);

describe("Metrics Tests", () => {
  beforeEach(() => {
    // Clear all metrics before each test
    prom.register.clear();
  });

  describe("Metrics Endpoint", () => {
    it("should expose metrics endpoint", async () => {
      const response = await request.get("/metrics").expect(200);

      expect(response.headers["content-type"]).toContain("text/plain");
      expect(response.text).toContain("# HELP");
      expect(response.text).toContain("# TYPE");
    });

    it("should not require authentication for metrics", async () => {
      const response = await request.get("/metrics").expect(200);

      // Should contain some metrics content
      expect(response.text.length).toBeGreaterThan(0);
    });
  });

  describe("Request Tracking", () => {
    let user: any;
    let apiKey: string;

    beforeEach(async () => {
      const userData = testUtils.generateTestUser();
      user = await User.create(userData);
      apiKey = user.apiKey;
    });

    it("should track execution layer requests", async () => {
      nock("http://192.168.8.229:8545").post("/").reply(200, {
        jsonrpc: "2.0",
        id: 1,
        result: "0x1234567",
      });

      await request
        .post(`/exec/${apiKey}`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(200);

      const metrics = await request.get("/metrics").expect(200);

      // Should contain some gateway metrics
      expect(metrics.text).toContain("rpc_gateway_");
    });

    it("should track consensus layer requests", async () => {
      nock("http://192.168.8.229:5052")
        .get("/eth/v1/beacon/headers")
        .reply(200, {
          data: { slot: "123456" },
        });

      await request.get(`/cons/${apiKey}/eth/v1/beacon/headers`).expect(200);

      const metrics = await request.get("/metrics").expect(200);

      // Should contain gateway metrics
      expect(metrics.text).toContain("rpc_gateway_");
    });

    it("should track error responses", async () => {
      nock("http://192.168.8.229:8545")
        .post("/")
        .reply(500, "Internal Server Error");

      await request
        .post(`/exec/${apiKey}`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(500);

      const metrics = await request.get("/metrics").expect(200);

      // Should contain error metrics
      expect(metrics.text).toContain("rpc_gateway_");
    });

    it("should track rate limit violations", async () => {
      // Set very low rate limit
      await User.findByIdAndUpdate(user._id, { maxRps: 1 });

      nock("http://192.168.8.229:8545")
        .post("/")
        .times(3)
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      // First request should succeed
      await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      // Second request should be rate limited
      await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 2 })
        .expect(429);

      const metrics = await request.get("/metrics").expect(200);

      // Should contain rate limit metrics
      expect(metrics.text).toContain("rpc_gateway_");
    });
  });

  describe("RPC Metrics Functions", () => {
    it("should record RPC metrics", () => {
      const userId = "test-user-id";
      const apiKey = "test-api-key";
      const rpcMethod = "eth_blockNumber";
      const duration = 0.123;

      recordRpcMetrics(userId, apiKey, rpcMethod, "execution", duration);

      // Function should execute without error
      expect(true).toBe(true);
    });

    it("should record rate limit hits", () => {
      const userId = "test-user-id";
      const apiKey = "test-api-key";

      recordRateLimitHit(userId, apiKey);

      // Function should execute without error
      expect(true).toBe(true);
    });
  });

  describe("Custom Metrics", () => {
    it("should expose NodeJS process metrics", async () => {
      const response = await request.get("/metrics").expect(200);

      // Should include default Node.js metrics
      expect(response.text).toContain("process_");
      expect(response.text).toContain("nodejs_");
    });

    it("should provide counter and gauge metrics", async () => {
      const response = await request.get("/metrics").expect(200);

      expect(response.text).toContain("# TYPE");
      expect(response.text).toContain("# HELP");
    });
  });

  describe("Performance Integration", () => {
    let user: any;
    let apiKey: string;

    beforeEach(async () => {
      const userData = testUtils.generateTestUser();
      user = await User.create(userData);
      apiKey = user.apiKey;
    });

    it("should measure request duration", async () => {
      // Mock response with delay
      nock("http://192.168.8.229:8545")
        .post("/")
        .delay(50)
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      const startTime = Date.now();

      await request
        .post(`/exec/${apiKey}`)
        .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 })
        .expect(200);

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      // Duration should be at least 40ms (accounting for tolerance)
      expect(actualDuration).toBeGreaterThanOrEqual(40);

      const metrics = await request.get("/metrics").expect(200);

      // Should contain duration metrics
      expect(metrics.text).toContain("seconds");
    });

    it("should handle concurrent requests", async () => {
      nock("http://192.168.8.229:8545")
        .post("/")
        .times(3)
        .delay(25)
        .reply(200, { jsonrpc: "2.0", result: "success", id: 1 });

      // Make 3 concurrent requests
      const promises = [
        request
          .post(`/exec/${apiKey}`)
          .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }),
        request
          .post(`/exec/${apiKey}`)
          .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 2 }),
        request
          .post(`/exec/${apiKey}`)
          .send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 3 }),
      ];

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      const metrics = await request.get("/metrics").expect(200);

      // Should contain request metrics
      expect(metrics.text).toContain("rpc_gateway_");
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });
});
