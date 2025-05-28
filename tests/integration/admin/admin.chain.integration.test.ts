import request from "supertest";
import express from "express";
import User from "../../../src/models/user.model";
import Chain, { IChain } from "../../../src/models/chain.model";
import adminRoutes from "../../../src/routes/admin.routes"; // The router for /api/v1/admin
import { MongoMemoryServer } from "mongodb-memory-server";
import database from "../../../src/config/database";

// Mocking the auth middleware to simulate admin and non-admin users
// For a real app, admin checks would be more robust, possibly a separate middleware.
let mockCurrentUser: { _id: string; isAdmin?: boolean } | null = null;

jest.mock("../../../src/auth/auth", () => {
  const mongoose = require("mongoose");
  return {
    auth: (req, res, next) => {
      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer admin-testtoken") &&
        mockCurrentUser?.isAdmin
      ) {
        req.user = {
          _id: new mongoose.Types.ObjectId(mockCurrentUser._id),
          isAdmin: true,
        }; // Simulate admin
        return next();
      } else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer user-testtoken") &&
        mockCurrentUser &&
        !mockCurrentUser.isAdmin
      ) {
        req.user = {
          _id: new mongoose.Types.ObjectId(mockCurrentUser._id),
          isAdmin: false,
        }; // Simulate regular user
        return next();
      }
      return res.status(401).json({ message: "Unauthorized from admin mock" });
    },
  };
});

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/v1/admin", adminRoutes); // Mount the admin routes

  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in admin test app:", err);
    res
      .status(500)
      .json({ message: "Internal server error in admin test app" });
  });
  return testApp;
};

let mongoServer: MongoMemoryServer;
let expressApp: express.Application;
let adminUserToken: string;
let regularUserToken: string;
let adminUserId: string;
let regularUserId: string;

describe("Admin Chain Routes Integration Tests (/api/v1/admin/chains)", () => {
  let initialChain: IChain;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    // Set the MONGO_URI in config for the test DB
    process.env.MONGO_URI = mongoUri;
    await database.connect();

    expressApp = setupExpressApp();

    // Create an admin user
    const adminUser = new User({
      email: "admin-chain@example.com",
      password: "password123",
    });
    await adminUser.save();
    adminUserId = adminUser._id.toString();
    adminUserToken = "admin-testtoken"; // Corresponds to mock

    // Create a regular user
    const regularUser = new User({
      email: "user-chain@example.com",
      password: "password123",
    });
    await regularUser.save();
    regularUserId = regularUser._id.toString();
    regularUserToken = "user-testtoken"; // Corresponds to mock
  });

  beforeEach(async () => {
    // Default to admin user for most tests
    mockCurrentUser = { _id: adminUserId, isAdmin: true };
    await Chain.deleteMany({});
    initialChain = new Chain({
      name: "Initial Test Chain",
      chainId: "001",
      adminNotes: "Initial",
    });
    await initialChain.save();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Chain.deleteMany({});
    await database.disconnect();
    await mongoServer.stop();
    mockCurrentUser = null; // Reset mock user
  });

  describe("POST /api/v1/admin/chains (Add Chain)", () => {
    it("should add a chain successfully (201) by an admin", async () => {
      const chainData = {
        name: "New Ethereum Testnet",
        chainId: "12345",
        isEnabled: true,
        adminNotes: "For testing ETH features",
      };
      const response = await request(expressApp)
        .post("/api/v1/admin/chains")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send(chainData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Chain added successfully.");
      // Verify in DB
      const created = await Chain.findOne({ chainId: chainData.chainId });
      expect(created).not.toBeNull();
      expect(created?.name).toBe(chainData.name);
    });

    it("should fail if name is missing (400)", async () => {
      const response = await request(expressApp)
        .post("/api/v1/admin/chains")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ chainId: "67890" });
      expect(response.status).toBe(400);
      expect(response.body).toContain("Missing required fields");
    });

    it("should fail if chainId is missing (400)", async () => {
      const response = await request(expressApp)
        .post("/api/v1/admin/chains")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ name: "Missing ChainID Test" });
      expect(response.status).toBe(400);
      expect(response.body).toContain("Missing required fields");
    });

    it("should fail if chain name already exists (409)", async () => {
      const response = await request(expressApp)
        .post("/api/v1/admin/chains")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ name: initialChain.name, chainId: "002-unique" });
      expect(response.status).toBe(409);
      expect(response.body).toContain("already exists");
    });

    it("should fail if chainId already exists (409)", async () => {
      const response = await request(expressApp)
        .post("/api/v1/admin/chains")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          name: "Unique Name For ChainID Test",
          chainId: initialChain.chainId,
        });
      expect(response.status).toBe(409);
      expect(response.body).toContain("already exists");
    });

    it("should fail if user is not an admin (401/403)", async () => {
      mockCurrentUser = { _id: regularUserId, isAdmin: false }; // Switch to regular user
      const chainData = { name: "Attempt by NonAdmin", chainId: "666" };
      const response = await request(expressApp)
        .post("/api/v1/admin/chains")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send(chainData);
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/admin/chains (List Chains)", () => {
    it("should retrieve all chains for an admin", async () => {
      await new Chain({ name: "Another Chain", chainId: "002" }).save();
      const response = await request(expressApp)
        .get("/api/v1/admin/chains")
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Chains retrieved successfully.");
      // Optionally, check DB for count
      const chains = await Chain.find();
      expect(chains.length).toBe(2); // initialChain + Another Chain
    });

    it("should fail if user is not an admin (401/403)", async () => {
      mockCurrentUser = { _id: regularUserId, isAdmin: false };
      const response = await request(expressApp)
        .get("/api/v1/admin/chains")
        .set("Authorization", `Bearer ${regularUserToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/v1/admin/chains/:chainIdToUpdate (Update Chain)", () => {
    it("should update a chain successfully by an admin", async () => {
      const updates = {
        name: "Updated Chain Name",
        isEnabled: false,
        adminNotes: "Updated notes",
      };
      const response = await request(expressApp)
        .put(`/api/v1/admin/chains/${initialChain.chainId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Chain updated successfully.");
      // Verify in DB
      const updated = await Chain.findOne({ chainId: initialChain.chainId });
      expect(updated?.name).toBe(updates.name);
      expect(updated?.isEnabled).toBe(updates.isEnabled);
      expect(updated?.adminNotes).toBe(updates.adminNotes);
    });

    it("should update only chainId successfully by an admin", async () => {
      const updates = { newChainId: "001-new" };
      const response = await request(expressApp)
        .put(`/api/v1/admin/chains/${initialChain.chainId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Chain updated successfully.");
      // Verify in DB
      const updated = await Chain.findOne({ chainId: updates.newChainId });
      expect(updated).not.toBeNull();
      expect(updated?.name).toBe(initialChain.name); // Name should be unchanged
    });

    it("should fail if chainIdToUpdate is not found (404)", async () => {
      const response = await request(expressApp)
        .put("/api/v1/admin/chains/nonexistent-chain-id")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ name: "Trying to update non-existent" });
      expect(response.status).toBe(404);
      expect(response.body).toContain("not found");
    });

    it("should fail if updated name conflicts with another chain (409)", async () => {
      const chain2 = await new Chain({
        name: "Existing Chain 2",
        chainId: "002",
      }).save();
      const response = await request(expressApp)
        .put(`/api/v1/admin/chains/${initialChain.chainId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ name: chain2.name }); // Try to update initialChain's name to chain2's name
      expect(response.status).toBe(409);
      expect(response.body).toContain("already exists");
      await Chain.deleteOne({ _id: chain2._id }); // cleanup
    });

    it("should fail if updated newChainId conflicts with another chain (409)", async () => {
      const chain2 = await new Chain({
        name: "Chain With Unique ID",
        chainId: "003-unique",
      }).save();
      const response = await request(expressApp)
        .put(`/api/v1/admin/chains/${initialChain.chainId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ newChainId: chain2.chainId });
      expect(response.status).toBe(409);
      expect(response.body).toContain("already exists");
      await Chain.deleteOne({ _id: chain2._id }); // cleanup
    });

    it("should fail if no update fields are provided (400)", async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/chains/${initialChain.chainId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({}); // Empty body
      expect(response.status).toBe(400);
      expect(response.body).toContain("No update fields provided");
    });

    it("should fail if user is not an admin (401/403)", async () => {
      mockCurrentUser = { _id: regularUserId, isAdmin: false };
      const response = await request(expressApp)
        .put(`/api/v1/admin/chains/${initialChain.chainId}`)
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send({ name: "Attempt by NonAdmin" });
      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/v1/admin/chains/:chainIdToDelete (Delete Chain)", () => {
    it("should delete a chain successfully by an admin", async () => {
      const response = await request(expressApp)
        .delete(`/api/v1/admin/chains/${initialChain.chainId}`)
        .set("Authorization", `Bearer ${adminUserToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Chain deleted successfully.");
      const found = await Chain.findOne({ chainId: initialChain.chainId });
      expect(found).toBeNull();
    });

    it("should fail if chain to delete is not found (404)", async () => {
      const response = await request(expressApp)
        .delete("/api/v1/admin/chains/nonexistent-chain-id-to-delete")
        .set("Authorization", `Bearer ${adminUserToken}`);
      expect(response.status).toBe(404);
      expect(response.body).toContain("not found");
    });

    it("should fail if user is not an admin (401/403)", async () => {
      mockCurrentUser = { _id: regularUserId, isAdmin: false };
      const response = await request(expressApp)
        .delete(`/api/v1/admin/chains/${initialChain.chainId}`)
        .set("Authorization", `Bearer ${regularUserToken}`);
      expect(response.status).toBe(401);
    });
  });
});
