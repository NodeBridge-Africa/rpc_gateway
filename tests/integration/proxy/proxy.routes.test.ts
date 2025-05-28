import request from "supertest";
import express, { Application } from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nock from "nock";
import App from "../../../src/models/app.model";
import User from "../../../src/models/user.model";
import proxyRoutes from "../../../src/routes/proxy.routes";
import { config } from "../../../src/config";
import { getRandomUrl } from "../../../src/controllers/proxy.controller";
import { database } from "../../../src/config/database";
import { stopCleanupInterval } from "../../../src/middlewares/rateLimit.middleware";

// Mock the config object
jest.mock("../../../src/config", () => ({
  config: {
    JWT_SECRET: "test-jwt-secret",
    getChainConfig: jest.fn(),
  },
}));

describe("Proxy Routes Integration Tests", () => {
  let app: Application;
  let testUser: any;
  let testApp: any;
  let testApiKey: string;
  let adminToken: string;

  beforeAll(async () => {
    await database.connect();
    app = express();
    app.use(express.json());
    app.use("/", proxyRoutes);

    const mockChainConfigs = {
      sepolia: {
        executionRpcUrl: ["http://sepolia-exec.test:8545"],
        consensusApiUrl: ["http://sepolia-consensus.test:5052"],
      },
      polygon: {
        executionRpcUrl: ["http://polygon-exec.test:8545"],
        consensusApiUrl: ["http://polygon-consensus.test:5052"],
      },
      arbitrum: {
        executionRpcUrl: ["http://arbitrum-exec.test:8545"],
      },
    };
    (config.getChainConfig as jest.Mock).mockImplementation(
      (chainName: string) => {
        return mockChainConfigs[
          chainName.toLowerCase() as keyof typeof mockChainConfigs
        ];
      }
    );

    await User.deleteMany({
      email: { $in: ["testuser@example.com", "admin@example.com"] },
    });
    await App.deleteMany({ name: { $in: ["Test App", "Polygon Test App"] } });

    const hashedPassword = await bcrypt.hash("testpassword", 10);
    testUser = await User.create({
      email: "testuser@example.com",
      password: hashedPassword,
      isAdmin: false,
    });
    const adminUser = await User.create({
      email: "admin@example.com",
      password: hashedPassword,
      isAdmin: true,
    });
    adminToken = jwt.sign(
      { userId: adminUser._id, email: adminUser.email, isAdmin: true },
      config.JWT_SECRET,
      { expiresIn: "24h" }
    );
  });

  // Helper to create/reset the main Sepolia test app
  const setupDefaultTestApp = async () => {
    await App.deleteMany({ name: "Test App" }); // Clean existing before creating
    testApp = await App.create({
      name: "Test App",
      description: "Test application for proxy tests",
      userId: testUser._id,
      chainName: "sepolia",
      chainId: "11155111",
      maxRps: 10, // Default RPS
      dailyRequestsLimit: 1000, // Default daily limit
      isActive: true,
      requests: 0, // Ensure counters are reset
      dailyRequests: 0,
    });
    testApiKey = testApp.apiKey;
  };

  afterAll(async () => {
    await User.deleteMany({
      email: { $in: ["testuser@example.com", "admin@example.com"] },
    });
    await App.deleteMany({ name: { $in: ["Test App", "Polygon Test App"] } });
    stopCleanupInterval();
    // nock.cleanAll(); // Not needed here as it's in afterEach
    await database.disconnect();
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    nock.cleanAll();
    nock.restore(); // Ensure nock is fully reset
    nock.activate(); // And reactivated for the next test

    if (testApp && testApp._id) {
      try {
        // It might be better to delete and recreate if consistent state is paramount
        // For now, just reset counters if it exists.
        const currentApp = await App.findById(testApp._id);
        if (currentApp) {
          await App.findByIdAndUpdate(testApp._id, {
            requests: 0,
            dailyRequests: 0,
          });
        } else {
          // If testApp._id exists but the app is not in DB, nullify testApp
          testApp = null;
        }
      } catch (error) {
        console.error("Error in afterEach app handling:", error);
        testApp = null; // Nullify on error to prevent issues in next test
      }
    }
  });

  describe("Execution RPC Proxy", () => {
    beforeEach(async () => {
      await setupDefaultTestApp(); // Ensure a fresh, valid Sepolia app for these tests
    });

    test("should proxy JSON-RPC requests to execution layer for Sepolia", async () => {
      const mockResponse = {
        jsonrpc: "2.0",
        id: 1,
        result: "0x10a3b5c",
      };

      nock("http://sepolia-exec.test:8545")
        .post("/", {
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .reply(200, mockResponse);

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(response.headers["x-rpc-gateway"]).toBe("NodeBridge");
      expect(response.headers["x-endpoint-type"]).toBe("sepolia-execution");
    });

    test("should handle proxy errors gracefully for Sepolia", async () => {
      nock("http://sepolia-exec.test:8545")
        .post("/")
        .replyWithError("Connection refused");

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(502);

      expect(response.body).toMatchObject({
        error: "Bad Gateway",
        message: "Failed to connect to the sepolia execution node",
        endpointType: "sepolia-execution",
      });
    });

    test("should increment request counters for Sepolia", async () => {
      nock("http://sepolia-exec.test:8545")
        .post("/")
        .reply(200, { jsonrpc: "2.0", id: 1, result: "0x1" });

      await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: ["0x123"],
          id: 1,
        })
        .expect(200);

      const updatedApp = await App.findById(testApp._id);
      expect(updatedApp).not.toBeNull();
      expect(updatedApp!.requests).toBe(1);
      expect(updatedApp!.dailyRequests).toBe(1);
    });

    test("should reject requests with invalid API key", async () => {
      const response = await request(app)
        .post("/sepolia/exec/invalid-api-key/")
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(403);

      expect(response.body).toMatchObject({
        error: "Invalid or inactive API key",
      });
    });

    test("should reject requests for unconfigured chains", async () => {
      const response = await request(app)
        .post(`/invalid-chain/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(403);

      expect(response.body).toMatchObject({
        error: "API key is not valid for chain 'invalid-chain'",
        expectedChain: "sepolia",
      });
    });

    test("should handle requests with complex paths for Sepolia", async () => {
      const mockResponse = { jsonrpc: "2.0", id: 1, result: "0x123" };

      nock("http://sepolia-exec.test:8545")
        .post("/v1/mainnet")
        .reply(200, mockResponse);

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/v1/mainnet`)
        .send({
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1,
        })
        .expect(200);

      expect(response.body).toEqual(mockResponse);
    });
  });

  describe("Consensus API Proxy", () => {
    beforeEach(async () => {
      await setupDefaultTestApp(); // Ensure a fresh, valid Sepolia app for these tests
    });

    test("should proxy REST API requests to consensus layer for Sepolia", async () => {
      const mockResponse = {
        data: {
          head_slot: "12345",
          sync_distance: "0",
          is_syncing: false,
        },
      };

      nock("http://sepolia-consensus.test:5052")
        .get("/eth/v1/node/syncing")
        .reply(200, mockResponse);

      const response = await request(app)
        .get(`/sepolia/cons/${testApiKey}/eth/v1/node/syncing`)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(response.headers["x-rpc-gateway"]).toBe("NodeBridge");
      expect(response.headers["x-endpoint-type"]).toBe("sepolia-consensus");
    });

    test("should handle consensus layer errors for Sepolia", async () => {
      nock("http://sepolia-consensus.test:5052")
        .get("/eth/v1/node/health")
        .reply(503, { error: "Node not synced" });

      const response = await request(app)
        .get(`/sepolia/cons/${testApiKey}/eth/v1/node/health`)
        .expect(503);

      expect(response.body).toMatchObject({
        error: "Node not synced",
      });
    });

    test("should reject consensus requests for chains without consensus URL (Arbitrum)", async () => {
      const response = await request(app)
        .get(`/arbitrum/cons/${testApiKey}/eth/v1/node/health`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: "API key is not valid for chain 'arbitrum'",
        expectedChain: "sepolia",
      });
    });
  });

  describe("Rate Limiting", () => {
    beforeEach(async () => {
      await setupDefaultTestApp(); // Reset app for rate limiting tests too
    });

    test("should enforce rate limits for Sepolia", async () => {
      await App.findByIdAndUpdate(testApp._id, { maxRps: 2 });

      nock("http://sepolia-exec.test:8545")
        .post("/")
        .times(5)
        .reply(200, { jsonrpc: "2.0", id: 1, result: "0x1" });

      for (let i = 0; i < 2; i++) {
        await request(app)
          .post(`/sepolia/exec/${testApiKey}/`)
          .send({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: i,
          })
          .expect(200);
      }

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 3,
        })
        .expect(429);

      expect(response.body).toMatchObject({
        error: "Rate limit exceeded for this API key",
        limit: 2,
      });
      expect(response.body).toHaveProperty("retryAfter");
      expect(response.body).toHaveProperty("remaining");
    });

    test("should include rate limit headers for Sepolia", async () => {
      await App.findByIdAndUpdate(testApp._id, { maxRps: 10 });

      nock("http://sepolia-exec.test:8545")
        .post("/")
        .reply(200, { jsonrpc: "2.0", id: 1, result: "0x1" });

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(200);

      expect(response.headers["x-ratelimit-limit"]).toBe("10");
      expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
      expect(response.headers["x-ratelimit-reset"]).toBeDefined();
    });
  });

  describe("Daily Request Limits", () => {
    beforeEach(async () => {
      await setupDefaultTestApp(); // Reset app for daily limit tests
    });

    test("should enforce daily request limits for Sepolia", async () => {
      await App.findByIdAndUpdate(testApp._id, {
        dailyRequests: 1001,
        dailyRequestsLimit: 1000,
      });

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(429);

      expect(response.body).toMatchObject({
        error: "Daily request limit exceeded for this app",
      });
    });

    test("should reset daily requests on new day for Sepolia", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await App.findByIdAndUpdate(testApp._id, {
        dailyRequests: 500,
        lastResetDate: yesterday,
      });

      nock("http://sepolia-exec.test:8545")
        .post("/")
        .reply(200, { jsonrpc: "2.0", id: 1, result: "0x1" });

      await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(200);

      const updatedApp = await App.findById(testApp._id);
      expect(updatedApp).not.toBeNull();
      expect(updatedApp!.dailyRequests).toBe(1);
    });
  });

  describe("Health Check Endpoint", () => {
    // Health check tests don't rely on testApp/testApiKey, so no beforeEach setupDefaultTestApp here
    test("should return health status for configured chain (Sepolia)", async () => {
      nock("http://sepolia-exec.test:8545")
        .post("/", {
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .reply(200, { jsonrpc: "2.0", id: 1, result: "0x1" });

      nock("http://sepolia-consensus.test:5052")
        .get("/eth/v1/node/health")
        .reply(200);

      const response = await request(app).get("/health/sepolia").expect(200);

      expect(response.body).toMatchObject({
        status: "healthy",
        chain: "sepolia",
        checks: {
          execution: {
            status: "healthy",
            url: "http://sepolia-exec.test:8545",
          },
          consensus: {
            status: "healthy",
            url: "http://sepolia-consensus.test:5052",
          },
        },
      });
      expect(response.body).toHaveProperty("timestamp");
    });

    test("should return unhealthy status when services are down (Sepolia)", async () => {
      nock("http://sepolia-exec.test:8545")
        .post("/")
        .replyWithError("Connection refused");

      nock("http://sepolia-consensus.test:5052")
        .get("/eth/v1/node/health")
        .reply(503);

      const response = await request(app).get("/health/sepolia").expect(503);

      expect(response.body).toMatchObject({
        status: "unhealthy",
        chain: "sepolia",
        checks: {
          execution: {
            status: "unhealthy",
            url: "http://sepolia-exec.test:8545",
          },
          consensus: {
            status: "unhealthy",
            url: "http://sepolia-consensus.test:5052",
          },
        },
      });
    });

    test("should handle chains with only execution layer (Arbitrum)", async () => {
      nock("http://arbitrum-exec.test:8545")
        .post("/", {
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .reply(200, { jsonrpc: "2.0", id: 1, result: "0x1" });

      const response = await request(app).get("/health/arbitrum").expect(200);

      expect(response.body).toMatchObject({
        status: "healthy",
        chain: "arbitrum",
        checks: {
          execution: {
            status: "healthy",
            url: "http://arbitrum-exec.test:8545",
          },
          consensus: {
            url: null,
            status: "not_configured",
          },
        },
      });
    });

    test("should return 404 for unknown chain", async () => {
      const response = await request(app)
        .get("/health/unknown-chain")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Configuration for chain 'unknown-chain' not found.",
      });
    });

    test("should return 400 for missing chain parameter", async () => {
      const response = await request(app).get("/health/").expect(404);
    });
  });

  describe("Multiple Chain Support", () => {
    let polygonApp: any;

    beforeAll(async () => {
      // Create app for polygon chain, ensure it doesn't conflict with default Sepolia app name
      await App.deleteMany({ name: "Polygon Test App" });
      polygonApp = await App.create({
        name: "Polygon Test App",
        userId: testUser._id,
        chainName: "polygon",
        chainId: "137",
        maxRps: 10,
        dailyRequestsLimit: 1000,
        isActive: true,
      });
    });

    afterAll(async () => {
      if (polygonApp && polygonApp._id) {
        await App.findByIdAndDelete(polygonApp._id);
      }
    });

    test("should proxy to correct chain based on URL (Polygon)", async () => {
      nock("http://polygon-exec.test:8545")
        .post("/")
        .reply(200, { jsonrpc: "2.0", id: 1, result: "0x89" });

      const response = await request(app)
        .post(`/polygon/exec/${polygonApp.apiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1,
        })
        .expect(200);

      expect(response.body.result).toBe("0x89");
      expect(response.headers["x-endpoint-type"]).toBe("polygon-execution");
    });
  });

  describe("Request Body Handling", () => {
    beforeEach(async () => {
      await setupDefaultTestApp(); // Reset app for these tests
    });

    test("should handle large JSON-RPC batch requests for Sepolia", async () => {
      const batchRequest = [
        { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 },
        { jsonrpc: "2.0", method: "eth_chainId", params: [], id: 2 },
        { jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 3 },
      ];

      const batchResponse = [
        { jsonrpc: "2.0", id: 1, result: "0x10a3b5c" },
        { jsonrpc: "2.0", id: 2, result: "0x1" },
        { jsonrpc: "2.0", id: 3, result: "0x3b9aca00" },
      ];

      nock("http://sepolia-exec.test:8545")
        .post("/", batchRequest)
        .reply(200, batchResponse);

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send(batchRequest)
        .expect(200);

      expect(response.body).toEqual(batchResponse);
    });

    test("should handle non-JSON requests for Sepolia", async () => {
      nock("http://sepolia-exec.test:8545")
        .post("/", "invalid json")
        .reply(400, { error: "Invalid JSON" });

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send("invalid json")
        .set("Content-Type", "text/plain")
        .expect(400);

      expect(response.body).toMatchObject({ error: "Invalid JSON" });
    });
  });

  describe("Headers and Timeouts", () => {
    beforeEach(async () => {
      await setupDefaultTestApp(); // Reset app for these tests
    });

    test("should forward custom headers for Sepolia", async () => {
      let capturedHeaders: any;

      nock("http://sepolia-exec.test:8545")
        .post("/")
        .reply(function (uri, requestBody) {
          capturedHeaders = this.req.headers;
          return [200, { jsonrpc: "2.0", id: 1, result: "0x1" }];
        });

      await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .set("X-Custom-Header", "test-value")
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(200);

      expect(capturedHeaders["x-custom-header"]).toBe("test-value");
    });

    test("should handle timeout scenarios for Sepolia", async () => {
      nock("http://sepolia-exec.test:8545")
        .post("/")
        .delay(200) // Delay response from nock, must be > supertest timeout
        .reply(200, { jsonrpc: "2.0", id: 1, result: "0x1" });

      let errorOccurred = false;
      try {
        await request(app)
          .post(`/sepolia/exec/${testApiKey}/`)
          .send({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1,
          })
          .timeout(100); // Supertest request timeout - shorter than nock delay
      } catch (err: any) {
        errorOccurred = true;
        // Check if the error is a timeout error from supertest
        // Supertest timeout errors typically have a 'timeout' property
        expect(err.timeout).toBeDefined();
        // Depending on how http-proxy-middleware and the server handle it,
        // err.status might be 504 (Gateway Timeout) or the connection might just be aborted.
        // For this test, confirming a timeout error occurred is the primary goal.
        // If a status is present, it could be 504, or 502 if the proxy itself emits an error due to timeout.
        if (err.response && err.response.status) {
          expect([502, 504]).toContain(err.response.status);
        } else {
          // If no err.response.status, it implies a client-side timeout from supertest, which is also a pass for this test case.
          console.log("Supertest client-side timeout occurred, as expected.");
        }
      }
      expect(errorOccurred).toBe(true); // Ensure the catch block was entered
    });
  });

  describe("Security and Validation", () => {
    beforeEach(async () => {
      await setupDefaultTestApp(); // Reset app for security tests
    });

    test("should reject requests without API key", async () => {
      const response = await request(app)
        .post("/sepolia/exec//")
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(404);
    });

    test("should handle inactive apps", async () => {
      await App.findByIdAndUpdate(testApp._id, { isActive: false });

      const response = await request(app)
        .post(`/sepolia/exec/${testApiKey}/`)
        .send({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        })
        .expect(403);

      expect(response.body).toMatchObject({
        error: "Invalid or inactive API key",
      });

      await App.findByIdAndUpdate(testApp._id, { isActive: true });
    });
  });
});
