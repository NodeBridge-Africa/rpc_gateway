import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import User, { IUser } from "../../../src/models/user.model";
import App, { IApp } from "../../../src/models/app.model";
import Chain from "../../../src/models/chain.model"; // Needed for app creation
import DefaultAppSettings from "../../../src/models/defaultAppSettings.model"; // Needed for app creation defaults
import adminRoutes from "../../../src/routes/admin.routes"; // Admin routes include /apps/:appId/limits

// Mock the auth middleware before imports
jest.mock("../../../src/auth/auth");
jest.mock("../../../src/middlewares/adminOnly");

// Import the mocked modules
import { auth } from "../../../src/auth/auth";
import { adminOnly } from "../../../src/middlewares/adminOnly";

// Declare variables at module level
let adminUserId: string;
let regularUserId: string;

// Set up the mock implementations
(auth as jest.MockedFunction<typeof auth>).mockImplementation(
  (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer admin-applimit-token")) {
      req.user = { _id: adminUserId, isAdmin: true };
      return next();
    } else if (authHeader.startsWith("Bearer user-applimit-token")) {
      req.user = { _id: regularUserId, isAdmin: false };
      return next();
    }
    return res
      .status(401)
      .json({ message: "Unauthorized from admin.app.limits mock" });
  }
);

(adminOnly as jest.MockedFunction<typeof adminOnly>).mockImplementation(
  (req: any, res: any, next: any) => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(401).json("Unauthorized: Admin access required.");
    }
    next();
  }
);

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/v1/admin", adminRoutes); // Mount admin routes

  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in admin.app.limits test app:", err);
    res
      .status(500)
      .json({ message: "Internal server error in admin.app.limits test app" });
  });
  return testApp;
};

let expressApp: express.Application;
let adminUserToken: string;
let regularUserToken: string;
let ownerOfTestApp: IUser;
let testChain: any;

describe("Admin App Limits Integration Tests (/api/v1/admin/apps/:appId/limits)", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || "");

    expressApp = setupExpressApp();

    // Clean up before starting
    await User.deleteMany({});
    await App.deleteMany({});
    await Chain.deleteMany({});
    await DefaultAppSettings.deleteMany({});

    // Admin user for performing actions
    const adminUser = new User({
      email: "admin-applimits@example.com",
      password: "password123",
    });
    await adminUser.save();
    adminUserId = adminUser._id.toString();
    adminUserToken = "admin-applimit-token";

    // Regular user who owns an app
    ownerOfTestApp = new User({
      email: "owner-applimits@example.com",
      password: "password123",
    });
    await ownerOfTestApp.save();
    regularUserId = ownerOfTestApp._id.toString();
    regularUserToken = "user-applimit-token"; // For testing non-admin access

    // Prerequisite: A chain and default app settings
    testChain = await new Chain({
      name: "LimitTestChain",
      chainId: "LT001",
      isEnabled: true,
    }).save();
    await DefaultAppSettings.findOneAndUpdate(
      {},
      { defaultMaxRps: 20, defaultDailyRequestsLimit: 10000 },
      { upsert: true }
    );
  });

  afterAll(async () => {
    await User.deleteMany({});
    await App.deleteMany({});
    await Chain.deleteMany({});
    await DefaultAppSettings.deleteMany({});
    await mongoose.disconnect();
  });

  describe("PUT /api/v1/admin/apps/:appId/limits", () => {
    let testApp: IApp;

    beforeEach(async () => {
      // Create a fresh app for each test
      testApp = await new App({
        name: "AppForLimitTesting",
        userId: ownerOfTestApp._id,
        chainName: testChain.name,
        chainId: testChain.chainId,
        maxRps: 20, // Initial value from defaults
        dailyRequestsLimit: 10000, // Initial value from defaults
      }).save();
    });

    afterEach(async () => {
      // Clean up the test app after each test
      await App.findByIdAndDelete(testApp._id);
    });

    it("should successfully update maxRps for an app", async () => {
      const newMaxRps = 50;
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ maxRps: newMaxRps });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("App limits updated successfully.");
      const dbApp = await App.findById(testApp._id);
      expect(dbApp).toBeTruthy();
      expect(dbApp?.maxRps).toBe(newMaxRps);
    });

    it("should successfully update dailyRequestsLimit for an app", async () => {
      const newDailyLimit = 20000;
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ dailyRequestsLimit: newDailyLimit });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("App limits updated successfully.");
      const dbApp = await App.findById(testApp._id);
      expect(dbApp).toBeTruthy();
      expect(dbApp?.dailyRequestsLimit).toBe(newDailyLimit);
    });

    it("should successfully update both maxRps and dailyRequestsLimit", async () => {
      const updates = { maxRps: 75, dailyRequestsLimit: 25000 };
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("App limits updated successfully.");
      const dbApp = await App.findById(testApp._id);
      expect(dbApp?.maxRps).toBe(updates.maxRps);
      expect(dbApp?.dailyRequestsLimit).toBe(updates.dailyRequestsLimit);
    });

    it("should fail if appId is not a valid ObjectId (400)", async () => {
      const response = await request(expressApp)
        .put("/api/v1/admin/apps/invalid-app-id/limits")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ maxRps: 10 });
      expect(response.status).toBe(400);
      expect(response.body).toBe("Invalid App ID format.");
    });

    it("should fail if appId does not exist (404)", async () => {
      const nonExistentAppId = new mongoose.Types.ObjectId();
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${nonExistentAppId}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ maxRps: 10 });
      expect(response.status).toBe(404);
      expect(response.body.message).toContain("not found");
    });

    it("should fail if no limit values are provided (400)", async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({}); // Empty body
      expect(response.status).toBe(400);
      expect(response.body).toBe(
        "At least one limit (maxRps or dailyRequestsLimit) must be provided."
      );
    });

    it("should fail if maxRps is not a number (400)", async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ maxRps: "invalid" });
      expect(response.status).toBe(400);
      expect(response.body).toBe(
        "Invalid value for maxRps. Must be a non-negative number."
      );
    });

    it("should fail if maxRps is negative (400)", async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ maxRps: -5 });
      expect(response.status).toBe(400);
      expect(response.body).toBe(
        "Invalid value for maxRps. Must be a non-negative number."
      );
    });

    it("should fail if dailyRequestsLimit is not a number (400)", async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ dailyRequestsLimit: "invalid" });
      expect(response.status).toBe(400);
      expect(response.body).toBe(
        "Invalid value for dailyRequestsLimit. Must be a non-negative number."
      );
    });

    it("should fail if dailyRequestsLimit is negative (400)", async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ dailyRequestsLimit: -100 });
      expect(response.status).toBe(400);
      expect(response.body).toBe(
        "Invalid value for dailyRequestsLimit. Must be a non-negative number."
      );
    });

    it("should deny access if user is not an admin (401)", async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testApp._id}/limits`)
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send({ maxRps: 100 });
      expect(response.status).toBe(401);
    });
  });
});
