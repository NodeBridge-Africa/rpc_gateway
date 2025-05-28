import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import adminRoutes from "../../../src/routes/admin.routes";

// Mock the auth middleware before imports
jest.mock("../../../src/auth/auth");
jest.mock("../../../src/middlewares/adminOnly");
jest.mock("axios");
jest.mock("../../../src/config/env");

// Import the mocked modules
import { auth } from "../../../src/auth/auth";
import { adminOnly } from "../../../src/middlewares/adminOnly";
import axios from "axios";
import { config } from "../../../src/config/env";

// Declare variables at module level
let adminUserId: string = "admin-user-id";

// Set up the mock implementations
(auth as jest.MockedFunction<typeof auth>).mockImplementation(
  (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer mock-admin-token")) {
      req.user = { _id: adminUserId, isAdmin: true };
      return next();
    }
    return res.status(401).json({ message: "Request not authenticated" });
  }
);

(adminOnly as jest.MockedFunction<typeof adminOnly>).mockImplementation(
  (req: any, res: any, next: any) => {
    if (!req.user || !req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: "Forbidden: Admin access required" });
    }
    next();
  }
);

// Mock the config
const mockConfig = config as jest.Mocked<typeof config>;
mockConfig.getChainConfig.mockImplementation((chainName: string) => {
  if (chainName === "testchain") {
    return {
      executionRpcUrl: ["http://test-exec.com"],
      consensusApiUrl: ["http://test-consensus.com"],
      prometheusUrl: [
        "http://test-prometheus1.com",
        "http://test-prometheus2.com",
      ],
    };
  }
  return undefined;
});

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/admin", adminRoutes);
  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in admin node health test app:", err);
    res.status(500).json({
      message: "Internal server error in admin node health test app",
    });
  });
  return testApp;
};

let expressApp: express.Application;

describe("Admin Node Health & Metrics Endpoints", () => {
  let adminToken: string = "mock-admin-token";
  const validChain = "testchain";
  const invalidChain = "nonexistentchain";

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || "");

    expressApp = setupExpressApp();

    // Mock axios responses
    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.post.mockImplementation(async (url: string, data: any) => {
      if (url.includes("test-exec.com")) {
        return {
          status: 200,
          data: {
            jsonrpc: "2.0",
            id: 1,
            result: false, // not syncing
          },
        };
      }
      throw new Error("Not found");
    });

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes("test-consensus.com/eth/v1/node/syncing")) {
        return {
          status: 200,
          data: {
            data: {
              is_syncing: false,
              head_slot: "1234567",
            },
          },
        };
      } else if (url.includes("test-prometheus1.com/metrics")) {
        return {
          status: 200,
          data: "go_memstats_alloc_bytes 1234567\ngo_goroutines 42\ngo_gc_cycles_total_gc_cycles_total 100\ngo_gc_heap_allocs_bytes_total 5000000\ngo_sync_mutex_wait_total_seconds_total 0.5\n",
        };
      } else if (url.includes("test-prometheus2.com/metrics")) {
        return {
          status: 200,
          data: "go_memstats_alloc_bytes 2345678\ngo_goroutines 50\ngo_gc_cycles_total_gc_cycles_total 150\ngo_gc_heap_allocs_bytes_total 6000000\ngo_sync_mutex_wait_total_seconds_total 0.8\n",
        };
      }
      throw new Error("Not found");
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    jest.clearAllMocks();
  });

  describe("GET /admin/node-health/:chain", () => {
    it("should return node health for a valid chain", async () => {
      const res = await request(expressApp)
        .get(`/admin/node-health/${validChain}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("chain", validChain);
      expect(res.body).toHaveProperty("overall");
      expect(res.body.execution.status).toBe("healthy");
      expect(res.body.consensus.status).toBe("healthy");
      expect(res.body.metrics.status).toBe("available");
      expect(res.body.metrics.totalNodes).toBe(2);
      expect(res.body.metrics.availableNodes).toBe(2);
      expect(res.body.metrics.nodes).toHaveLength(2);
      expect(res.body.metrics.nodes[0]).toHaveProperty("status", "available");
      expect(res.body.metrics.nodes[1]).toHaveProperty("status", "available");
    });

    it("should return 404 for an invalid chain", async () => {
      const res = await request(expressApp)
        .get(`/admin/node-health/${invalidChain}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(expressApp).get(
        `/admin/node-health/${validChain}`
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET /admin/node-metrics/:chain", () => {
    it("should return node metrics for a valid chain", async () => {
      const res = await request(expressApp)
        .get(`/admin/node-metrics/${validChain}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("chain", validChain);
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("totalNodes", 2);
      expect(res.body).toHaveProperty("availableNodes", 2);
      expect(res.body).toHaveProperty("nodes");
      expect(res.body.nodes).toHaveLength(2);

      // Check first node
      expect(res.body.nodes[0]).toHaveProperty("nodeIndex", 0);
      expect(res.body.nodes[0]).toHaveProperty(
        "nodeUrl",
        "http://test-prometheus1.com"
      );
      expect(res.body.nodes[0]).toHaveProperty("status", "available");
      expect(res.body.nodes[0].metrics.go_runtime.goroutines).toBe("42");

      // Check second node
      expect(res.body.nodes[1]).toHaveProperty("nodeIndex", 1);
      expect(res.body.nodes[1]).toHaveProperty(
        "nodeUrl",
        "http://test-prometheus2.com"
      );
      expect(res.body.nodes[1]).toHaveProperty("status", "available");
      expect(res.body.nodes[1].metrics.go_runtime.goroutines).toBe("50");
    });

    it("should handle partial node failures gracefully", async () => {
      // Mock one prometheus endpoint to fail
      const mockedAxios = axios as jest.Mocked<typeof axios>;
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes("test-prometheus1.com/metrics")) {
          throw new Error("Connection timeout");
        } else if (url.includes("test-prometheus2.com/metrics")) {
          return {
            status: 200,
            data: "go_memstats_alloc_bytes 2345678\ngo_goroutines 50\ngo_gc_cycles_total_gc_cycles_total 150\ngo_gc_heap_allocs_bytes_total 6000000\ngo_sync_mutex_wait_total_seconds_total 0.8\n",
          };
        } else if (url.includes("test-consensus.com/eth/v1/node/syncing")) {
          return {
            status: 200,
            data: {
              data: {
                is_syncing: false,
                head_slot: "1234567",
              },
            },
          };
        }
        throw new Error("Not found");
      });

      const res = await request(expressApp)
        .get(`/admin/node-metrics/${validChain}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalNodes", 2);
      expect(res.body).toHaveProperty("availableNodes", 1);

      // Check failed node
      expect(res.body.nodes[0]).toHaveProperty("status", "unavailable");
      expect(res.body.nodes[0]).toHaveProperty("error", "Connection timeout");
      expect(res.body.nodes[0]).toHaveProperty("metrics", null);

      // Check successful node
      expect(res.body.nodes[1]).toHaveProperty("status", "available");
      expect(res.body.nodes[1].metrics.go_runtime.goroutines).toBe("50");

      // Restore original mock
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes("test-consensus.com/eth/v1/node/syncing")) {
          return {
            status: 200,
            data: {
              data: {
                is_syncing: false,
                head_slot: "1234567",
              },
            },
          };
        } else if (url.includes("test-prometheus1.com/metrics")) {
          return {
            status: 200,
            data: "go_memstats_alloc_bytes 1234567\ngo_goroutines 42\ngo_gc_cycles_total_gc_cycles_total 100\ngo_gc_heap_allocs_bytes_total 5000000\ngo_sync_mutex_wait_total_seconds_total 0.5\n",
          };
        } else if (url.includes("test-prometheus2.com/metrics")) {
          return {
            status: 200,
            data: "go_memstats_alloc_bytes 2345678\ngo_goroutines 50\ngo_gc_cycles_total_gc_cycles_total 150\ngo_gc_heap_allocs_bytes_total 6000000\ngo_sync_mutex_wait_total_seconds_total 0.8\n",
          };
        }
        throw new Error("Not found");
      });
    });

    it("should return 404 for an invalid chain", async () => {
      const res = await request(expressApp)
        .get(`/admin/node-metrics/${invalidChain}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(expressApp).get(
        `/admin/node-metrics/${validChain}`
      );
      expect(res.status).toBe(401);
    });
  });
});
