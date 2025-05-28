import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import User from "../../../src/models/user.model";
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
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer admin-token")) {
      req.user = { _id: adminUserId, isAdmin: true };
      return next();
    } else if (authHeader.startsWith("Bearer user-token")) {
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
    console.error("Unhandled error in admin users test app:", err);
    res.status(500).json({
      message: "Internal server error in admin users test app",
    });
  });
  return testApp;
};

let expressApp: express.Application;
let adminToken: string;
let regularUserToken: string;

describe("PATCH /admin/users/:userId", () => {
  let testUser: any;
  let otherUser: any; // For email conflict test

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || "");

    expressApp = setupExpressApp();

    // Clean up before starting
    await User.deleteMany({});

    // Create admin user
    const adminUser = new User({
      email: "admin-users@example.com",
      password: "password123",
    });
    await adminUser.save();
    adminUserId = adminUser._id.toString();
    adminToken = "admin-token";

    // Create regular user
    const regularUser = new User({
      email: "regular-users@example.com",
      password: "password123",
    });
    await regularUser.save();
    regularUserId = regularUser._id.toString();
    regularUserToken = "user-token";
  });

  beforeEach(async () => {
    // Clean up test users but keep admin and regular users
    await User.deleteMany({
      email: {
        $nin: ["admin-users@example.com", "regular-users@example.com"],
      },
    });

    testUser = await User.create({
      email: "testuser.to.update@example.com",
      password: "Password123!",
      isActive: true,
    });

    otherUser = await User.create({
      email: "otheruser@example.com",
      password: "Password456!",
      isActive: true,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  test("Test 1: Unauthorized (no token)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .send({ isActive: false });
    expect(response.status).toBe(401);
  });

  test("Test 1b: Forbidden (non-admin token)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .set("Authorization", `Bearer ${regularUserToken}`)
      .send({ isActive: false });
    expect(response.status).toBe(403);
  });

  test("Test 2: Invalid User ID in path", async () => {
    const response = await request(expressApp)
      .patch("/admin/users/invalid-user-id")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(response.status).toBe(400);
    expect(response.body.error.msg).toBe("Invalid User ID format");
  });

  test("Test 3: Empty request body", async () => {
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.error.msg).toContain("Request body cannot be empty");
  });

  test("Test 4: Invalid field in body (e.g., bad email)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "not-an-email" });
    expect(response.status).toBe(400);
    expect(response.body.error.path).toBe("email");
    expect(response.body.error.msg).toBe("Invalid email format");
  });

  test("Test 4b: Invalid password (too short)", async () => {
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "short" });
    expect(response.status).toBe(400);
    expect(response.body.error.path).toBe("password");
    expect(response.body.error.msg).toBe(
      "Password must be between 8 and 128 characters"
    );
  });

  test("Test 5: User not found", async () => {
    const nonExistentUserId = new Types.ObjectId().toString();
    const response = await request(expressApp)
      .patch(`/admin/users/${nonExistentUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      `User with ID '${nonExistentUserId}' not found.`
    );
  });

  test("Test 6: Successful user update (no password)", async () => {
    const updateData = {
      email: "updated.email@example.com",
      isActive: false,
    };
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User details updated successfully.");

    const dbUser = await User.findById(testUser._id);
    expect(dbUser?.email).toBe(updateData.email);
    expect(dbUser?.isActive).toBe(updateData.isActive);
  });

  test("Test 7: Successful user update (with password)", async () => {
    const newPassword = "newSecurePassword123";
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: newPassword, isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User details updated successfully.");

    const dbUser = await User.findById(testUser._id);
    expect(dbUser?.isActive).toBe(false);
    // Verify password was changed by checking it's different from the original
    // Direct comparison of hashed password is tricky, but user.comparePassword should work
    const isMatch = await dbUser?.comparePassword(newPassword);
    expect(isMatch).toBe(true);

    const isOldPasswordMatch = await dbUser?.comparePassword("Password123!");
    expect(isOldPasswordMatch).toBe(false);
  });

  test("Test 8: Email already exists", async () => {
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: otherUser.email }); // Attempt to set testUser's email to otherUser's email

    expect(response.status).toBe(409);
    expect(response.body).toBe(
      "Email address is already in use by another account."
    );
  });

  test("Test 9: Update only isActive status", async () => {
    const response = await request(expressApp)
      .patch(`/admin/users/${testUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User details updated successfully.");

    const dbUser = await User.findById(testUser._id);
    expect(dbUser?.isActive).toBe(false);
    expect(dbUser?.email).toBe(testUser.email);
  });
});
