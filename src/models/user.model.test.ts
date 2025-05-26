import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User, { IUser } from './user.model';

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

describe('User Model', () => {
  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  it('should create a user with default values for appCount and isAdmin', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
    };
    const user = new User(userData);
    await user.save();

    expect(user._id).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.appCount).toBe(0); // Default value
    expect(user.isAdmin).toBe(false); // Default value
    expect(user.isActive).toBe(true); // Default value from original schema if not overridden
  });

  it('should require email and password', async () => {
    let error: any;
    try {
      const user = new User({});
      await user.save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.email).toBeDefined();
    expect(error.errors.password).toBeDefined();
  });

  it('email should be unique', async () => {
    const userData1 = { email: 'unique@example.com', password: 'password123' };
    await new User(userData1).save();

    const userData2 = { email: 'unique@example.com', password: 'password456' };
    let error;
    try {
      await new User(userData2).save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    // @ts-ignore
    expect(error.code).toBe(11000); // MongoDB duplicate key error
  });

  it('should hash password before saving', async () => {
    const rawPassword = 'passwordToHash';
    const user = new User({ email: 'hash@example.com', password: rawPassword });
    await user.save();

    expect(user.password).not.toBe(rawPassword);
    const isMatch = await user.comparePassword(rawPassword);
    expect(isMatch).toBe(true);
  });

  it('comparePassword method should work correctly', async () => {
    const rawPassword = 'password123';
    const user = new User({ email: 'compare@example.com', password: rawPassword });
    await user.save();

    expect(await user.comparePassword(rawPassword)).toBe(true);
    expect(await user.comparePassword('wrongpassword')).toBe(false);
  });

  it('should have timestamps (createdAt, updatedAt)', async () => {
    const user = new User({ email: 'timestamp@example.com', password: 'password123' });
    await user.save();

    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();

    const initialUpdatedAt = user.updatedAt;
    user.email = 'timestamp.updated@example.com'; // Change a field to trigger update
    await user.save(); // Save again to update timestamps
    expect(user.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
  });

  it('should verify that removed fields are not present', async () => {
    const user = new User({ email: 'removedfields@example.com', password: 'password123' });
    await user.save();
    const userObject = user.toObject();

    expect(userObject.apiKey).toBeUndefined();
    expect(userObject.maxRps).toBeUndefined();
    expect(userObject.requests).toBeUndefined();
    expect(userObject.dailyRequests).toBeUndefined();
    expect(userObject.lastResetDate).toBeUndefined();
    // Check for methods that might have been on the old schema
    expect((user as any).generateNewApiKey).toBeUndefined();
    expect((user as any).resetDailyRequestsIfNeeded).toBeUndefined();
  });

  it('should correctly set appCount and isAdmin when provided', async () => {
    const userData = {
      email: 'adminuser@example.com',
      password: 'password123',
      appCount: 3,
      isAdmin: true,
    };
    const user = new User(userData);
    await user.save();

    expect(user.appCount).toBe(3);
    expect(user.isAdmin).toBe(true);
  });
});
