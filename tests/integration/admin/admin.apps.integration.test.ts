import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import User from "../../../src/models/user.model";
import App from "../../../src/models/app.model";
import adminRoutes from "../../../src/routes/admin.routes";
import { Types } from "mongoose";

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
    // Use headers to determine user context for tests
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer admin-testtoken")) {
      req.user = { _id: adminUserId, isAdmin: true };
      return next();
    } else if (authHeader.startsWith("Bearer user-testtoken")) {
      req.user = { _id: regularUserId, isAdmin: false };
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

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/admin", adminRoutes);
  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in admin apps test app:", err);
    res.status(500).json({
      message: "Internal server error in admin apps test app",
    });
  });
  return testApp;
};

let expressApp: express.Application;
let adminToken: string;
let regularUserToken: string;
let testApp: any;
let testUser: any;

describe("PATCH /admin/apps/:appId", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || "");

    expressApp = setupExpressApp();

    // Create admin user
    const adminUser = new User({
      email: "admin-apps@example.com",
      password: "password123",
    });
    await adminUser.save();
    adminUserId = adminUser._id.toString();
    adminToken = "admin-testtoken";

    // Create regular user
    const regularUser = new User({
      email: "user-apps@example.com",
      password: "password123",
    });
    await regularUser.save();
    regularUserId = regularUser._id.toString();
    regularUserToken = "user-testtoken";
  });

  beforeEach(async () => {
    // Clean up apps but keep users
    await App.deleteMany({});

    // Create a user for the app
    testUser = await User.create({
      email: "appowner@example.com",
      password: "Password123!",
      isActive: true,
    });

    testApp = await App.create({
      name: "Original Test App",
      description: "Original Description",
      userId: testUser._id,
      chainName: "Sepolia",
      chainId: "11155111",
      maxRps: 10,
      dailyRequestsLimit: 1000,
      isActive: true,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await App.deleteMany({});
    await mongoose.disconnect();
  });

  test("Test 1: Unauthorized (no token)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/apps/${testApp._id}`)
      .send({ name: "Updated Name" });
    expect(response.status).toBe(401);
  });

  test("Test 2: Forbidden (non-admin token)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/apps/${testApp._id}`)
      .set("Authorization", `Bearer ${regularUserToken}`)
      .send({ name: "Updated Name" });
    expect(response.status).toBe(403);
  });

  test("Test 3: Invalid App ID in path", async () => {
    const response = await request(expressApp)
      .patch("/admin/apps/invalid-app-id")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Updated Name" });
    expect(response.status).toBe(400);
    expect(response.body.error.msg).toBe("Invalid App ID format");
  });

  test("Test 4: Empty request body", async () => {
    const response = await request(expressApp)
      .patch(`/admin/apps/${testApp._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(response.status).toBe(400);
    // Based on express-validator custom rule
    expect(response.body.error.msg).toContain("Request body cannot be empty");
  });

  test("Test 5: Invalid field in body (e.g., maxRps as string)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/apps/${testApp._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ maxRps: "not-a-number" });
    expect(response.status).toBe(400);
    expect(response.body.error.path).toBe("maxRps");
    expect(response.body.error.msg).toBe(
      "maxRps must be a non-negative integer"
    );
  });

  test("Test 5b: Invalid apiKey format (not UUID)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/apps/${testApp._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ apiKey: "not-a-uuid" });
    expect(response.status).toBe(400);
    expect(response.body.error.path).toBe("apiKey");
    expect(response.body.error.msg).toBe("apiKey must be a valid UUID v4");
  });

  test("Test 6: App not found", async () => {
    const nonExistentAppId = new Types.ObjectId().toString();
    const response = await request(expressApp)
      .patch(`/admin/apps/${nonExistentAppId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Updated Name" });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      `App with ID '${nonExistentAppId}' not found.`
    );
  });

  test("Test 7: Successful app update (multiple fields)", async () => {
    const newUserId = new Types.ObjectId().toString(); // Simulate a different user
    const updateData = {
      name: "Updated App Name",
      description: "Updated Description",
      isActive: false,
      maxRps: 20,
      userId: newUserId, // Ensure this user exists or test will fail on FK if enforced
    };

    // Create the new user if needed for this test to pass FK constraints if they exist at DB level
    // For this test, we assume it's just an ID field and no strict FK check at DB level for App model
    // or that the controller doesn't check User existence for userId field.

    const response = await request(expressApp)
      .patch(`/admin/apps/${testApp._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("App details updated successfully.");

    const dbApp = await App.findById(testApp._id);
    expect(dbApp?.name).toBe(updateData.name);
    expect(dbApp?.description).toBe(updateData.description);
    expect(dbApp?.isActive).toBe(updateData.isActive);
    expect(dbApp?.maxRps).toBe(updateData.maxRps);
    expect(dbApp?.userId.toString()).toBe(newUserId);
  });

  test("Test 8: Attempt to update with only an empty string apiKey (should be ignored by controller)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/apps/${testApp._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ apiKey: "", name: "Name Change With Empty APIKey" }); // Controller should filter out empty apiKey

    // Since apiKey is optional but must be UUID if provided, empty string will fail validation
    expect(response.status).toBe(400);
    expect(response.body.error.path).toBe("apiKey");
    expect(response.body.error.msg).toBe("apiKey must be a valid UUID v4");
  });
});
