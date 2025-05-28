import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import User from "../../../src/models/user.model";
import App from "../../../src/models/app.model";
import Chain from "../../../src/models/chain.model";
import DefaultAppSettings from "../../../src/models/defaultAppSettings.model";
import appRoutes from "../../../src/routes/app.routes";

// Mock the auth middleware before imports
jest.mock("../../../src/auth/auth");

// Import the mocked modules
import { auth } from "../../../src/auth/auth";

// Declare variables at module level
let testUserId: string;
let testUser2Id: string;

// Set up the mock implementations
(auth as jest.MockedFunction<typeof auth>).mockImplementation(
  (req: any, res: any, next: any) => {
    // Use headers to determine user context for tests
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer testuser1-token")) {
      req.user = { _id: testUserId, email: "testuser1@example.com" };
      return next();
    } else if (authHeader.startsWith("Bearer testuser2-token")) {
      req.user = { _id: testUser2Id, email: "testuser2@example.com" };
      return next();
    }
    return res.status(401).json({ message: "Request not authenticated" });
  }
);

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/apps", appRoutes);
  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in app routes test:", err);
    res.status(500).json({
      message: "Internal server error in app routes test",
    });
  });
  return testApp;
};

let expressApp: express.Application;
let testUser1Token: string;
let testUser2Token: string;
let testChain: any;
let defaultSettings: any;

describe("App Routes Integration Tests", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || "");

    expressApp = setupExpressApp();

    // Create test users
    const testUser1 = new User({
      email: "testuser1@example.com",
      password: "password123",
      isActive: true,
    });
    await testUser1.save();
    testUserId = testUser1._id.toString();
    testUser1Token = "testuser1-token";

    const testUser2 = new User({
      email: "testuser2@example.com",
      password: "password123",
      isActive: true,
    });
    await testUser2.save();
    testUser2Id = testUser2._id.toString();
    testUser2Token = "testuser2-token";

    // Create test chain
    testChain = await Chain.create({
      name: "Sepolia",
      chainId: "11155111",
      isEnabled: true,
    });

    // Create default app settings
    defaultSettings = await DefaultAppSettings.create({
      defaultMaxRps: 20,
      defaultDailyRequestsLimit: 10000,
    });
  });

  beforeEach(async () => {
    // Clean up apps but keep users, chains, and settings
    await App.deleteMany({});

    // Ensure the test chain exists (might have been deleted in previous tests)
    const chainExists = await Chain.findOne({
      name: "Sepolia",
      chainId: "11155111",
    });
    if (!chainExists) {
      testChain = await Chain.create({
        name: "Sepolia",
        chainId: "11155111",
        isEnabled: true,
      });
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await App.deleteMany({});
    await Chain.deleteMany({});
    await DefaultAppSettings.deleteMany({});
    await mongoose.disconnect();
  });

  describe("POST /apps - Create App", () => {
    test("should successfully create an app with valid data", async () => {
      const appData = {
        name: "Test App",
        description: "A test application",
        chainName: "Sepolia",
        chainId: "11155111",
      };

      const response = await request(expressApp)
        .post("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`)
        .send(appData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("App created successfully.");
      expect(response.body.app).toMatchObject({
        name: appData.name,
        description: appData.description,
        chainName: appData.chainName,
        chainId: appData.chainId,
        maxRps: defaultSettings.defaultMaxRps,
        dailyRequestsLimit: defaultSettings.defaultDailyRequestsLimit,
        isActive: true,
        requests: 0,
        dailyRequests: 0,
      });
      expect(response.body.app.userId).toBe(testUserId);
      expect(response.body.app.apiKey).toBeDefined();
      expect(response.body.app._id).toBeDefined();
    });

    test("should create app without description (optional field)", async () => {
      const appData = {
        name: "Test App Without Description",
        chainName: "Sepolia",
        chainId: "11155111",
      };

      const response = await request(expressApp)
        .post("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`)
        .send(appData);

      expect(response.status).toBe(201);
      expect(response.body.app.name).toBe(appData.name);
      expect(response.body.app.description).toBeUndefined();
    });

    test("should return 401 when no authentication token provided", async () => {
      const appData = {
        name: "Test App",
        chainName: "Sepolia",
        chainId: "11155111",
      };

      const response = await request(expressApp).post("/apps").send(appData);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Request not authenticated");
    });

    test("should return 400 when required fields are missing", async () => {
      const incompleteData = {
        name: "Test App",
        // Missing chainName and chainId
      };

      const response = await request(expressApp)
        .post("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body).toBe(
        "Missing required fields: name, chainName, chainId."
      );
    });

    test("should return 404 when chain does not exist", async () => {
      const appData = {
        name: "Test App",
        chainName: "NonExistentChain",
        chainId: "999999",
      };

      const response = await request(expressApp)
        .post("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`)
        .send(appData);

      expect(response.status).toBe(404);
      expect(response.body).toBe(
        "Chain 'NonExistentChain' with chainId '999999' not found or is not enabled."
      );
    });

    test("should return 404 when chain is disabled", async () => {
      // Create a disabled chain
      const disabledChain = await Chain.create({
        name: "DisabledChain",
        chainId: "123456",
        isEnabled: false,
      });

      const appData = {
        name: "Test App",
        chainName: "DisabledChain",
        chainId: "123456",
      };

      const response = await request(expressApp)
        .post("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`)
        .send(appData);

      expect(response.status).toBe(404);
      expect(response.body).toBe(
        "Chain 'DisabledChain' with chainId '123456' not found or is not enabled."
      );

      await Chain.deleteOne({ _id: disabledChain._id });
    });

    test("should enforce app limit per user (5 apps max)", async () => {
      // Create 5 apps for the user
      for (let i = 0; i < 5; i++) {
        await App.create({
          name: `App ${i + 1}`,
          userId: testUserId,
          chainName: "Sepolia",
          chainId: "11155111",
          maxRps: 20,
          dailyRequestsLimit: 10000,
        });
      }

      const appData = {
        name: "App 6 - Should Fail",
        chainName: "Sepolia",
        chainId: "11155111",
      };

      const response = await request(expressApp)
        .post("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`)
        .send(appData);

      expect(response.status).toBe(403);
      expect(response.body).toBe("User cannot create more than 5 apps.");
    });

    test("should use fallback values when DefaultAppSettings not found", async () => {
      // Remove default settings temporarily
      await DefaultAppSettings.deleteMany({});

      // Ensure the chain exists (might have been deleted in previous tests)
      const chainExists = await Chain.findOne({
        name: "Sepolia",
        chainId: "11155111",
      });
      if (!chainExists) {
        await Chain.create({
          name: "Sepolia",
          chainId: "11155111",
          isEnabled: true,
        });
      }

      const appData = {
        name: "Test App with Fallback",
        chainName: "Sepolia",
        chainId: "11155111",
      };

      const response = await request(expressApp)
        .post("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`)
        .send(appData);

      expect(response.status).toBe(201);
      expect(response.body.app.maxRps).toBe(20); // Fallback value
      expect(response.body.app.dailyRequestsLimit).toBe(10000); // Fallback value

      // Restore default settings
      defaultSettings = await DefaultAppSettings.create({
        defaultMaxRps: 20,
        defaultDailyRequestsLimit: 10000,
      });
    });
  });

  describe("GET /apps - Get User Apps", () => {
    beforeEach(async () => {
      // Create some test apps for testUser1
      await App.create({
        name: "User1 App 1",
        description: "First app",
        userId: testUserId,
        chainName: "Sepolia",
        chainId: "11155111",
        maxRps: 20,
        dailyRequestsLimit: 10000,
        apiKey: "11111111-1111-1111-1111-111111111111",
      });

      await App.create({
        name: "User1 App 2",
        description: "Second app",
        userId: testUserId,
        chainName: "Sepolia",
        chainId: "11155111",
        maxRps: 30,
        dailyRequestsLimit: 15000,
        apiKey: "22222222-2222-2222-2222-222222222222",
      });

      // Create an app for testUser2
      await App.create({
        name: "User2 App 1",
        userId: testUser2Id,
        chainName: "Sepolia",
        chainId: "11155111",
        maxRps: 20,
        dailyRequestsLimit: 10000,
        apiKey: "33333333-3333-3333-3333-333333333333",
      });
    });

    test("should return all apps for authenticated user", async () => {
      const response = await request(expressApp)
        .get("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "User applications retrieved successfully."
      );
      expect(response.body.apps).toHaveLength(2);
      expect(response.body.apps[0].name).toBe("User1 App 1");
      expect(response.body.apps[1].name).toBe("User1 App 2");

      // API keys should be excluded
      expect(response.body.apps[0].apiKey).toBeUndefined();
      expect(response.body.apps[1].apiKey).toBeUndefined();
    });

    test("should return empty array when user has no apps", async () => {
      // Delete all apps for testUser2
      await App.deleteMany({ userId: testUser2Id });

      const response = await request(expressApp)
        .get("/apps")
        .set("Authorization", `Bearer ${testUser2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "User applications retrieved successfully."
      );
      expect(response.body.apps).toHaveLength(0);
    });

    test("should return 401 when no authentication token provided", async () => {
      const response = await request(expressApp).get("/apps");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Request not authenticated");
    });

    test("should only return apps belonging to the authenticated user", async () => {
      const response = await request(expressApp)
        .get("/apps")
        .set("Authorization", `Bearer ${testUser2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.apps).toHaveLength(1);
      expect(response.body.apps[0].name).toBe("User2 App 1");
    });

    test("should return app details without sensitive information", async () => {
      const response = await request(expressApp)
        .get("/apps")
        .set("Authorization", `Bearer ${testUser1Token}`);

      expect(response.status).toBe(200);
      const app = response.body.apps[0];

      // Check that expected fields are present
      expect(app).toHaveProperty("_id");
      expect(app).toHaveProperty("name");
      expect(app).toHaveProperty("description");
      expect(app).toHaveProperty("chainName");
      expect(app).toHaveProperty("chainId");
      expect(app).toHaveProperty("maxRps");
      expect(app).toHaveProperty("dailyRequestsLimit");
      expect(app).toHaveProperty("isActive");
      expect(app).toHaveProperty("createdAt");
      expect(app).toHaveProperty("updatedAt");

      // Ensure apiKey is not included
      expect(app).not.toHaveProperty("apiKey");
    });
  });
});
