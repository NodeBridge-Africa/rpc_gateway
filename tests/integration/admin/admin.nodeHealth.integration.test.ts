import request from "supertest";
import app from "../../../src/app";
import mongoose from "mongoose";

// Helper to get a valid admin token (mock or real, depending on your setup)
async function getAdminToken() {
  // Replace with your actual admin token logic
  return "mock-admin-token";
}

describe("Admin Node Health & Metrics Endpoints", () => {
  let adminToken: string;
  const validChain = "testchain";
  const invalidChain = "nonexistentchain";

  beforeAll(async () => {
    adminToken = await getAdminToken();
    // Optionally, set up a test chain in DB or mock
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("GET /admin/node-health/:chain", () => {
    it("should return node health for a valid chain", async () => {
      const res = await request(app)
        .get(`/admin/node-health/${validChain}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status");
      // Add more assertions based on your response structure
    });

    it("should return 404 for an invalid chain", async () => {
      const res = await request(app)
        .get(`/admin/node-health/${invalidChain}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get(`/admin/node-health/${validChain}`);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /admin/node-metrics/:chain", () => {
    it("should return node metrics for a valid chain", async () => {
      const res = await request(app)
        .get(`/admin/node-metrics/${validChain}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("metrics");
      // Add more assertions based on your response structure
    });

    it("should return 404 for an invalid chain", async () => {
      const res = await request(app)
        .get(`/admin/node-metrics/${invalidChain}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get(`/admin/node-metrics/${validChain}`);
      expect(res.status).toBe(401);
    });
  });
});
