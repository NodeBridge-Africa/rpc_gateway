import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import App, { IApp } from './app.model';
import User from './user.model'; // Required for userId ref
import { DEFAULT_APP_MAX_RPS } from '../config/constants';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('App Model', () => {
  let userId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Create a dummy user for app association
    const user = await User.create({ email: 'testuser@example.com', password: 'password123' });
    userId = user._id;
  });

  it('should create an app with default values', async () => {
    const appData = {
      userId,
      name: 'Test App',
      chainName: 'TestChain',
      chainId: '123',
    };
    const app = new App(appData);
    await app.save();

    expect(app._id).toBeDefined();
    expect(app.apiKey).toBeDefined();
    expect(app.apiKey.length).toBeGreaterThan(0);
    expect(app.maxRps).toBe(DEFAULT_APP_MAX_RPS);
    expect(app.requests).toBe(0);
    expect(app.dailyRequests).toBe(0);
    expect(app.isActive).toBe(true);
    expect(app.lastResetDate).toBeDefined();
    // Check if lastResetDate is recent (e.g., within the last few seconds)
    const timeDiff = Date.now() - app.lastResetDate.getTime();
    expect(timeDiff).toBeLessThan(5000); // Less than 5 seconds
  });

  it('should require userId, name, chainName, and chainId', async () => {
    let error: any;
    try {
      const app = new App({ description: 'Missing fields' });
      await app.save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.userId).toBeDefined();
    expect(error.errors.name).toBeDefined();
    expect(error.errors.chainName).toBeDefined();
    expect(error.errors.chainId).toBeDefined();
  });

  describe('resetDailyRequestsIfNeeded method', () => {
    it('should reset dailyRequests and update lastResetDate if the day has passed', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const app = new App({
        userId,
        name: 'Reset Test App',
        chainName: 'TestChain',
        chainId: '789',
        dailyRequests: 100,
        lastResetDate: yesterday,
      });
      await app.save();

      await app.resetDailyRequestsIfNeeded();

      expect(app.dailyRequests).toBe(0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(app.lastResetDate.getFullYear()).toBe(today.getFullYear());
      expect(app.lastResetDate.getMonth()).toBe(today.getMonth());
      expect(app.lastResetDate.getDate()).toBe(today.getDate());
    });

    it('should not reset dailyRequests if it is the same day', async () => {
      const today = new Date();
      const app = new App({
        userId,
        name: 'No Reset Test App',
        chainName: 'TestChain',
        chainId: '000',
        dailyRequests: 50,
        lastResetDate: today, // Set to now
      });
      await app.save();

      await app.resetDailyRequestsIfNeeded();

      expect(app.dailyRequests).toBe(50);
      // Ensure lastResetDate is still today (or very close to it if save() updates it slightly)
       const timeDiff = today.getTime() - app.lastResetDate.getTime();
      // Allow for a small difference due to the save operation potentially updating timestamps
      expect(Math.abs(timeDiff)).toBeLessThan(5000); // within 5 seconds
    });
  });

   it('apiKey should be unique', async () => {
    const appData1 = { userId, name: 'App1', chainName: 'Chain1', chainId: '1' };
    const app1 = new App(appData1);
    await app1.save();

    // Manually try to create another app with the same apiKey (highly unlikely to generate same uuid)
    // This tests the unique constraint at DB level if we were to force it
    // For practical purposes, uuidv4's collision probability is negligible.
    // A better test for DB constraint would be to save app1, then try to save app2 with app1.apiKey
    const appData2 = { userId, name: 'App2', chainName: 'Chain2', chainId: '2', apiKey: app1.apiKey };
    const app2 = new App(appData2);
    let error;
    try {
      await app2.save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    // @ts-ignore
    expect(error.code).toBe(11000); // MongoDB duplicate key error
  });


  it('should correctly set optional description', async () => {
    const appDescription = 'This is a test description.';
    const app = new App({
      userId,
      name: 'App With Description',
      chainName: 'DescChain',
      chainId: '321',
      description: appDescription,
    });
    await app.save();
    expect(app.description).toBe(appDescription);
  });

  it('should have timestamps (createdAt, updatedAt)', async () => {
    const app = new App({
      userId,
      name: 'Timestamp App',
      chainName: 'TimeChain',
      chainId: '654',
    });
    await app.save();

    expect(app.createdAt).toBeDefined();
    expect(app.updatedAt).toBeDefined();

    const initialUpdatedAt = app.updatedAt;
    app.name = 'Timestamp App Updated';
    await app.save();
    expect(app.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
  });
});
