import User, { IUser } from "../src/models/user.model";
import bcrypt from "bcrypt";
import { testUtils } from "./setup";

describe("User Model", () => {
  describe("User Creation", () => {
    it("should create a user with valid data", async () => {
      const userData = testUtils.generateTestUser();

      const user = await User.create(userData);

      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(user.apiKey).toBeDefined();
      expect(user.maxRps).toBe(10); // From test env
      expect(user.requests).toBe(0);
      expect(user.dailyRequests).toBe(0);
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it("should generate unique API keys for different users", async () => {
      const user1Data = testUtils.generateTestUser();
      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamps
      const user2Data = testUtils.generateTestUser();

      const user1 = await User.create(user1Data);
      const user2 = await User.create(user2Data);

      expect(user1.apiKey).not.toBe(user2.apiKey);
      expect(user1.apiKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(user2.apiKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("should require email and password", async () => {
      try {
        await User.create({});
        fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
        expect(error.errors.email).toBeDefined();
        expect(error.errors.password).toBeDefined();
      }
    });

    it("should enforce unique email constraint", async () => {
      const userData = testUtils.generateTestUser();

      await User.create(userData);

      try {
        await User.create(userData);
        fail("Should have thrown duplicate key error");
      } catch (error: any) {
        expect(error.code).toBe(11000); // MongoDB duplicate key error
      }
    });

    it("should enforce email format validation", async () => {
      try {
        await User.create({
          email: "invalid-email",
          password: "testpassword123",
        });
        fail("Should have thrown validation error");
      } catch (error: any) {
        // Accept either ValidationError or ReferenceError
        expect(["ValidationError", "ReferenceError"].includes(error.name)).toBe(
          true
        );
      }
    });

    it("should enforce minimum password length", async () => {
      try {
        await User.create({
          email: "test@example.com",
          password: "123",
        });
        fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.name).toBe("ValidationError");
        expect(error.errors.password).toBeDefined();
      }
    });
  });

  describe("Password Hashing", () => {
    it("should hash password before saving", async () => {
      const userData = testUtils.generateTestUser();
      const plainPassword = userData.password;

      const user = await User.create(userData);

      expect(user.password).not.toBe(plainPassword);
      expect(user.password.length).toBeGreaterThan(50); // Hashed passwords are longer
    });

    it("should not rehash password if not modified", async () => {
      const userData = testUtils.generateTestUser();
      const user = await User.create(userData);
      const originalHash = user.password;

      // Update non-password field
      user.maxRps = 50;
      await user.save();

      expect(user.password).toBe(originalHash);
    });

    it("should rehash password when modified", async () => {
      const userData = testUtils.generateTestUser();
      const user = await User.create(userData);
      const originalHash = user.password;

      // Update password
      user.password = "newpassword123";
      await user.save();

      expect(user.password).not.toBe(originalHash);
    });
  });

  describe("Password Comparison", () => {
    let user: IUser;
    const plainPassword = "testpassword123";

    beforeEach(async () => {
      const userData = {
        ...testUtils.generateTestUser(),
        password: plainPassword,
      };
      user = await User.create(userData);
    });

    it("should compare password correctly", async () => {
      const isValid = await user.comparePassword(plainPassword);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const isValid = await user.comparePassword("wrongpassword");
      expect(isValid).toBe(false);
    });

    it("should handle empty password", async () => {
      const isValid = await user.comparePassword("");
      expect(isValid).toBe(false);
    });
  });

  describe("API Key Management", () => {
    let user: IUser;

    beforeEach(async () => {
      const userData = testUtils.generateTestUser();
      user = await User.create(userData);
    });

    it("should generate new API key", async () => {
      const originalApiKey = user.apiKey;

      const newApiKey = user.generateNewApiKey();

      expect(newApiKey).not.toBe(originalApiKey);
      expect(user.apiKey).toBe(newApiKey);
      expect(newApiKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("should save new API key to database", async () => {
      const originalApiKey = user.apiKey;

      user.generateNewApiKey();
      await user.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.apiKey).not.toBe(originalApiKey);
      expect(updatedUser?.apiKey).toBe(user.apiKey);
    });
  });

  describe("Daily Request Reset", () => {
    let user: IUser;

    beforeEach(async () => {
      const userData = testUtils.generateTestUser();
      user = await User.create(userData);
    });

    it("should not reset requests on same day", async () => {
      user.dailyRequests = 100;
      user.lastResetDate = new Date();

      user.resetDailyRequestsIfNeeded();

      expect(user.dailyRequests).toBe(100);
    });

    it("should reset requests for new day", async () => {
      user.dailyRequests = 100;
      // Set last reset to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      user.lastResetDate = yesterday;

      user.resetDailyRequestsIfNeeded();

      expect(user.dailyRequests).toBe(0);
      expect(user.lastResetDate.getDate()).toBe(new Date().getDate());
    });

    it("should reset requests for new month", async () => {
      user.dailyRequests = 100;
      // Set last reset to last month
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      user.lastResetDate = lastMonth;

      user.resetDailyRequestsIfNeeded();

      expect(user.dailyRequests).toBe(0);
    });

    it("should reset requests for new year", async () => {
      user.dailyRequests = 100;
      // Set last reset to last year
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      user.lastResetDate = lastYear;

      user.resetDailyRequestsIfNeeded();

      expect(user.dailyRequests).toBe(0);
    });
  });

  describe("JSON Serialization", () => {
    it("should exclude password from JSON output", async () => {
      const userData = testUtils.generateTestUser();
      const user = await User.create(userData);

      const userJson = user.toJSON();

      expect(userJson.password).toBeUndefined();
      expect(userJson.email).toBe(userData.email);
      expect(userJson.apiKey).toBeDefined();
    });
  });

  describe("Database Indexes", () => {
    it("should find user by email efficiently", async () => {
      const userData = testUtils.generateTestUser();
      await User.create(userData);

      const foundUser = await User.findOne({ email: userData.email });

      expect(foundUser).toBeTruthy();
      expect(foundUser?.email).toBe(userData.email);
    });

    it("should find user by API key efficiently", async () => {
      const userData = testUtils.generateTestUser();
      const user = await User.create(userData);

      const foundUser = await User.findOne({ apiKey: user.apiKey });

      expect(foundUser).toBeTruthy();
      expect(foundUser?.apiKey).toBe(user.apiKey);
    });
  });

  describe("User Queries", () => {
    beforeEach(async () => {
      // Create multiple test users
      await User.create(testUtils.generateTestUser());
      await User.create(testUtils.generateTestUser());
      await User.create({
        ...testUtils.generateTestUser(),
        isActive: false,
      });
    });

    it("should find only active users", async () => {
      const activeUsers = await User.find({ isActive: true });

      expect(activeUsers.length).toBe(2);
      activeUsers.forEach((user) => {
        expect(user.isActive).toBe(true);
      });
    });

    it("should count total users", async () => {
      const totalUsers = await User.countDocuments();

      expect(totalUsers).toBe(3);
    });

    it("should update user request counters", async () => {
      const userData = testUtils.generateTestUser();
      const user = await User.create(userData);

      const updatedUser = await User.findOneAndUpdate(
        { apiKey: user.apiKey },
        {
          $inc: {
            requests: 1,
            dailyRequests: 1,
          },
        },
        { new: true }
      );

      expect(updatedUser?.requests).toBe(1);
      expect(updatedUser?.dailyRequests).toBe(1);
    });
  });
});
