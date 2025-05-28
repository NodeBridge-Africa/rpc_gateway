import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import User from "../../../src/models/user.model";
import authRoutes from "../../../src/routes/auth.routes";
import jwt from "jsonwebtoken";

// Mock the auth middleware
jest.mock("../../../src/middlewares/auth.middleware");

// Import the mocked module
import { auth } from "../../../src/middlewares/auth.middleware";

// Declare variables at module level
let testUserId: string;

// Set up the mock implementation
(auth as jest.MockedFunction<typeof auth>).mockImplementation(
  (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization || "";

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Access denied. No valid token provided." });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      req.userId = decoded.id;
      testUserId = decoded.id;
      return next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid token." });
    }
  }
);

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/auth", authRoutes);
  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in auth routes test:", err);
    res.status(500).json({
      message: "Internal server error in auth routes test",
    });
  });
  return testApp;
};

let expressApp: express.Application;

describe("Auth Routes Integration Tests", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || "");
    expressApp = setupExpressApp();
  });

  beforeEach(async () => {
    // Clean up users before each test
    await User.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  describe("POST /auth/register - User Registration", () => {
    test("should successfully register a new user", async () => {
      const userData = {
        email: "newuser@example.com",
        password: "password123",
      };

      const response = await request(expressApp)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("token");
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data.user).toHaveProperty("email", userData.email);

      // Verify user was created in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeDefined();
      expect(user?.email).toBe(userData.email);
      expect(user?.password).not.toBe(userData.password); // Password should be hashed
    });

    test("should return 400 when email is invalid", async () => {
      const userData = {
        email: "invalid-email",
        password: "password123",
      };

      const response = await request(expressApp)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          path: "email",
          msg: expect.any(String),
        })
      );
    });

    test("should return 400 when password is too short", async () => {
      const userData = {
        email: "user@example.com",
        password: "12345", // Less than 6 characters
      };

      const response = await request(expressApp)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          path: "password",
          msg: "Password must be at least 6 characters long",
        })
      );
    });

    test("should return 400 when required fields are missing", async () => {
      const response = await request(expressApp)
        .post("/auth/register")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    test("should return 409 when user already exists", async () => {
      const userData = {
        email: "existing@example.com",
        password: "password123",
      };

      // Create user first
      // Don't hash the password - the User model will do it automatically
      await User.create({
        email: userData.email,
        password: userData.password,
      });

      // Try to register again with same email
      const response = await request(expressApp)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("already exists");
    });

    test("should normalize email to lowercase", async () => {
      const userData = {
        email: "TestUser@Example.COM",
        password: "password123",
      };

      const response = await request(expressApp)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(201);

      const user = await User.findOne({ email: "testuser@example.com" });
      expect(user).toBeDefined();
    });
  });

  describe("POST /auth/login - User Login", () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await User.create({
        email: "testuser@example.com",
        password: "password123",
        isActive: true,
      });
    });

    test("should successfully login with valid credentials", async () => {
      const loginData = {
        email: "testuser@example.com",
        password: "password123",
      };

      const response = await request(expressApp)
        .post("/auth/login")
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("token");
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data.user).toHaveProperty("email", loginData.email);

      // Verify token is valid
      const decoded = jwt.verify(
        response.body.data.token,
        process.env.JWT_SECRET!
      ) as any;
      expect(decoded).toHaveProperty("id");
    });

    test("should return 401 with invalid password", async () => {
      const loginData = {
        email: "testuser@example.com",
        password: "wrongpassword",
      };

      const response = await request(expressApp)
        .post("/auth/login")
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid email or password");
    });

    test("should return 401 when user does not exist", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "password123",
      };

      const response = await request(expressApp)
        .post("/auth/login")
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid email or password");
    });

    test("should return 400 when email is invalid", async () => {
      const loginData = {
        email: "invalid-email",
        password: "password123",
      };

      const response = await request(expressApp)
        .post("/auth/login")
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          path: "email",
          msg: expect.any(String),
        })
      );
    });

    test("should return 400 when password is missing", async () => {
      const loginData = {
        email: "testuser@example.com",
      };

      const response = await request(expressApp)
        .post("/auth/login")
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation failed");
      expect(response.body).toHaveProperty("details");
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          path: "password",
          msg: "Password is required",
        })
      );
    });

    test("should return 401 when user account is inactive", async () => {
      // Create inactive user
      await User.create({
        email: "inactive@example.com",
        password: "password123",
        isActive: false,
      });

      const loginData = {
        email: "inactive@example.com",
        password: "password123",
      };

      const response = await request(expressApp)
        .post("/auth/login")
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid email or password");
    });

    test("should normalize email for login", async () => {
      const loginData = {
        email: "TestUser@Example.COM",
        password: "password123",
      };

      const response = await request(expressApp)
        .post("/auth/login")
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("token");
    });
  });

  describe("GET /auth/account - Get Account Info", () => {
    let validToken: string;
    let testUser: any;

    beforeEach(async () => {
      // Create a test user
      testUser = await User.create({
        email: "accountuser@example.com",
        password: "password123",
        isActive: true,
      });

      // Generate a valid token
      validToken = jwt.sign(
        { id: testUser._id.toString() },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" }
      );
    });

    test("should successfully get account info with valid token", async () => {
      const response = await request(expressApp)
        .get("/auth/account")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data.user).toHaveProperty(
        "id",
        testUser._id.toString()
      );
      expect(response.body.data.user).toHaveProperty("email", testUser.email);
      expect(response.body.data.user).toHaveProperty("isActive", true);
      expect(response.body.data.user).not.toHaveProperty("password"); // Password should be excluded
    });

    test("should return 401 when no token is provided", async () => {
      const response = await request(expressApp).get("/auth/account");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        "error",
        "Access denied. No valid token provided."
      );
    });

    test("should return 401 when token is invalid", async () => {
      const response = await request(expressApp)
        .get("/auth/account")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid token.");
    });

    test("should return 401 when token is expired", async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { id: testUser._id.toString() },
        process.env.JWT_SECRET!,
        { expiresIn: "-1h" } // Expired 1 hour ago
      );

      const response = await request(expressApp)
        .get("/auth/account")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid token.");
    });

    test("should return 404 when user no longer exists", async () => {
      // Delete the user
      await User.deleteOne({ _id: testUser._id });

      const response = await request(expressApp)
        .get("/auth/account")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "User not found");
    });

    test("should work with different authorization header formats", async () => {
      // Test with lowercase "bearer"
      const response = await request(expressApp)
        .get("/auth/account")
        .set("Authorization", `bearer ${validToken}`);

      expect(response.status).toBe(401); // Should fail because middleware expects "Bearer" with capital B
      expect(response.body).toHaveProperty(
        "error",
        "Access denied. No valid token provided."
      );
    });
  });
});
