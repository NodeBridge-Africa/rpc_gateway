import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app'; // Adjust path as needed
import User from '../../src/models/user.model';
import App from '../../src/models/app.model';
import Chain from '../../src/models/chain.model';

let mongoServer: MongoMemoryServer;

export const setup = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {
    //useNewUrlParser: true, // Deprecated but common in older examples
    //useUnifiedTopology: true, // Deprecated
  });
};

export const teardown = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

export const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

// You can add more helper functions here, e.g., for creating users, apps, etc.
// For example:
export const createUser = async (userData: any) => {
  return await User.create(userData);
};

export const loginUser = async (request: any, email: string, password_plaintext: string) => {
  const response = await request.post('/auth/login').send({ email, password: password_plaintext });
  return response.body.data.token;
};

// Global beforeAll and afterAll for Jest
beforeAll(async () => {
  await setup();
});

afterAll(async () => {
  await teardown();
});

// Optional: Clear database before each test
beforeEach(async () => {
  await clearDatabase();
});

export { app }; // Export the app for supertest
// Export models if needed directly in tests, though it's better to interact via API
export { User, App, Chain };
