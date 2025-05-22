import supertest from "supertest";
import { createTestApp } from "./helpers/testApp";
import User from "../src/models/user.model";
import { testUtils } from "./setup";

const app = createTestApp();
const request = supertest(app);

describe("Authentication", () => {
  describe("POST /auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = testUtils.generateTestUser();

      const response = await request
        .post("/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.apiKey).toBeDefined();
      expect(response.body.data.token).toBeDefined();

      // Verify user was created in database
      const userInDb = await User.findOne({ email: userData.email });
      expect(userInDb).toBeTruthy();
      expect(userInDb?.apiKey).toBe(response.body.data.apiKey);
    });

    it("should not register user with invalid email", async () => {
      const userData = {
        email: "invalid-email",
        password: "testpassword123",
      };

      const response = await request
        .post("/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.details).toBeDefined();
    });

    it("should not register user with short password", async () => {
      const userData = {
        email: "test@example.com",
        password: "123",
      };

      const response = await request
        .post("/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });

    it("should not register duplicate email", async () => {
      const userData = testUtils.generateTestUser();

      // Register first user
      await request.post("/auth/register").send(userData).expect(201);

      // Try to register same email again
      const response = await request
        .post("/auth/register")
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe("User already exists with this email");
    });
  });

  describe("POST /auth/login", () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = testUtils.generateTestUser();
      await request.post("/auth/register").send(testUser).expect(201);
    });

    it("should login with valid credentials", async () => {
      const response = await request
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.apiKey).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it("should not login with invalid email", async () => {
      const response = await request
        .post("/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should not login with invalid password", async () => {
      const response = await request
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: "wrongpassword",
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should not login with invalid email format", async () => {
      const response = await request
        .post("/auth/login")
        .send({
          email: "invalid-email",
          password: testUser.password,
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("GET /auth/account", () => {
    let token: string;
    let apiKey: string;
    let testUser: any;

    beforeEach(async () => {
      testUser = testUtils.generateTestUser();
      const registerResponse = await request
        .post("/auth/register")
        .send(testUser)
        .expect(201);

      token = registerResponse.body.data.token;
      apiKey = registerResponse.body.data.apiKey;
    });

    it("should get account info with valid token", async () => {
      const response = await request
        .get("/auth/account")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.apiKey).toBe(apiKey);
      expect(response.body.data.endpoints.execution).toContain(apiKey);
      expect(response.body.data.endpoints.consensus).toContain(apiKey);
    });

    it("should not get account info without token", async () => {
      const response = await request.get("/auth/account").expect(401);

      expect(response.body.error).toBe(
        "Access denied. No valid token provided."
      );
    });

    it("should not get account info with invalid token", async () => {
      const response = await request
        .get("/auth/account")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.error).toBe("Invalid token.");
    });
  });

  describe("POST /auth/regenerate-api-key", () => {
    let token: string;
    let originalApiKey: string;
    let testUser: any;

    beforeEach(async () => {
      testUser = testUtils.generateTestUser();
      const registerResponse = await request
        .post("/auth/register")
        .send(testUser)
        .expect(201);

      token = registerResponse.body.data.token;
      originalApiKey = registerResponse.body.data.apiKey;
    });

    it("should regenerate API key with valid token", async () => {
      const response = await request
        .post("/auth/regenerate-api-key")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toBeDefined();
      expect(response.body.data.apiKey).not.toBe(originalApiKey);
      expect(response.body.data.endpoints.execution).toContain(
        response.body.data.apiKey
      );
    });

    it("should not regenerate API key without token", async () => {
      const response = await request
        .post("/auth/regenerate-api-key")
        .expect(401);

      expect(response.body.error).toBe(
        "Access denied. No valid token provided."
      );
    });
  });

  describe("GET /auth/usage", () => {
    let token: string;
    let testUser: any;

    beforeEach(async () => {
      testUser = testUtils.generateTestUser();
      const registerResponse = await request
        .post("/auth/register")
        .send(testUser)
        .expect(201);

      token = registerResponse.body.data.token;
    });

    it("should get usage statistics with valid token", async () => {
      const response = await request
        .get("/auth/usage")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBe(0);
      expect(response.body.data.dailyRequests).toBe(0);
      expect(response.body.data.dailyLimit).toBe(1000); // From test env
      expect(response.body.data.rateLimitRps).toBe(10); // From test env
      expect(response.body.data.remainingDaily).toBe(1000);
      expect(response.body.data.lastResetDate).toBeDefined();
    });

    it("should not get usage statistics without token", async () => {
      const response = await request.get("/auth/usage").expect(401);

      expect(response.body.error).toBe(
        "Access denied. No valid token provided."
      );
    });
  });
});
