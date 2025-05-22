import mongoose from "mongoose";

// Setup function for test environment
export const setupTestEnvironment = async () => {
  // Use local MongoDB for tests
  const mongoUri =
    process.env.MONGO_URI || "mongodb://localhost:27017/nodebridge_test";

  // Set test environment variables
  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
  process.env.NODE_ENV = "test";
  process.env.EXECUTION_RPC_URL = "http://192.168.8.229:8545";
  process.env.CONSENSUS_API_URL = "http://192.168.8.229:5052";
  process.env.DEFAULT_MAX_RPS = "10";
  process.env.DEFAULT_DAILY_REQUESTS = "1000";

  // Connect to the database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
};

// Cleanup function for each test
export const cleanupTestData = async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
};

// Teardown function
export const teardownTestEnvironment = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
};

export const testUtils = {
  generateTestUser: () => ({
    email: `test${Date.now()}@example.com`,
    password: "testpassword123",
  }),

  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Global setup and teardown for Jest environment
beforeAll(async () => {
  await setupTestEnvironment();
});

afterAll(async () => {
  await teardownTestEnvironment();
});

afterEach(async () => {
  await cleanupTestData();
});
