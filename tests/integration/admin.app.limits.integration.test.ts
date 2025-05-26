import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import User, { IUser } from '../../src/models/user.model';
import App, { IApp } from '../../src/models/app.model';
import Chain from '../../src/models/chain.model'; // Needed for app creation
import DefaultAppSettings from '../../src/models/defaultAppSettings.model'; // Needed for app creation defaults
import adminRoutes from '../../src/routes/admin.routes'; // Admin routes include /apps/:appId/limits
import { MongoMemoryServer } from 'mongodb-memory-server';

// Mocking auth middleware
let currentMockUser: { _id: string, isAdmin?: boolean } | null = null;
jest.mock('../../src/auth/auth', () => ({
  auth: (req: any, res: any, next: any) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer admin-applimit-token') && currentMockUser?.isAdmin) {
      req.user = { _id: new mongoose.Types.ObjectId(currentMockUser._id), isAdmin: true };
      return next();
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer user-applimit-token') && currentMockUser && !currentMockUser.isAdmin) {
      req.user = { _id: new mongoose.Types.ObjectId(currentMockUser._id), isAdmin: false };
      return next();
    }
    return res.status(401).json({ message: 'Unauthorized from admin.app.limits mock' });
  },
}));

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/v1/admin', adminRoutes); // Mount admin routes
  
  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in admin.app.limits test app:", err);
    res.status(500).json({ message: "Internal server error in admin.app.limits test app" });
  });
  return testApp;
};

let mongoServer: MongoMemoryServer;
let expressApp: express.Application;
let adminUserToken: string;
let regularUserToken: string;
let adminUserId: string;
let testAppForLimits: IApp;
let ownerOfTestApp: IUser;

describe('Admin App Limits Integration Tests (/api/v1/admin/apps/:appId/limits)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    expressApp = setupExpressApp();

    // Admin user for performing actions
    const adminUser = new User({ email: 'admin-applimits@example.com', password: 'password123' });
    await adminUser.save();
    adminUserId = adminUser._id.toString();
    adminUserToken = 'admin-applimit-token';

    // Regular user who owns an app
    ownerOfTestApp = new User({ email: 'owner-applimits@example.com', password: 'password123' });
    await ownerOfTestApp.save();
    regularUserToken = 'user-applimit-token'; // For testing non-admin access

    // Prerequisite: A chain and default app settings
    const chain = await new Chain({ name: 'LimitTestChain', chainId: 'LT001', isEnabled: true }).save();
    await DefaultAppSettings.findOneAndUpdate({}, { defaultMaxRps: 20, defaultDailyRequestsLimit: 10000 }, { upsert: true });
    
    // Create an app to be managed
    testAppForLimits = new App({
      name: 'AppForLimitTesting',
      userId: ownerOfTestApp._id,
      chainName: chain.name,
      chainId: chain.chainId,
      maxRps: 20, // Initial value from defaults
      dailyRequestsLimit: 10000, // Initial value from defaults
    });
    await testAppForLimits.save();
  });

  beforeEach(async () => {
    // Default to admin user for tests that require admin rights
    currentMockUser = { _id: adminUserId, isAdmin: true };
  });

  afterAll(async () => {
    await User.deleteMany({});
    await App.deleteMany({});
    await Chain.deleteMany({});
    await DefaultAppSettings.deleteMany({});
    await mongoose.disconnect();
    await mongoServer.stop();
    currentMockUser = null;
  });

  describe('PUT /api/v1/admin/apps/:appId/limits', () => {
    it('should successfully update maxRps for an app', async () => {
      const newMaxRps = 50;
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ maxRps: newMaxRps });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.app.maxRps).toBe(newMaxRps);
      const dbApp = await App.findById(testAppForLimits._id);
      expect(dbApp?.maxRps).toBe(newMaxRps);
    });

    it('should successfully update dailyRequestsLimit for an app', async () => {
      const newDailyLimit = 20000;
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ dailyRequestsLimit: newDailyLimit });

      expect(response.status).toBe(200);
      expect(response.body.data.app.dailyRequestsLimit).toBe(newDailyLimit);
      const dbApp = await App.findById(testAppForLimits._id);
      expect(dbApp?.dailyRequestsLimit).toBe(newDailyLimit);
    });

    it('should successfully update both maxRps and dailyRequestsLimit', async () => {
      const updates = { maxRps: 75, dailyRequestsLimit: 25000 };
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.data.app.maxRps).toBe(updates.maxRps);
      expect(response.body.data.app.dailyRequestsLimit).toBe(updates.dailyRequestsLimit);
    });

    it('should fail if appId is not a valid ObjectId (400)', async () => {
      const response = await request(expressApp)
        .put('/api/v1/admin/apps/invalid-app-id/limits')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ maxRps: 10 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid App ID format.');
    });

    it('should fail if appId does not exist (404)', async () => {
      const nonExistentAppId = new mongoose.Types.ObjectId();
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${nonExistentAppId}/limits`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ maxRps: 10 });
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should fail if no limit values are provided (400)', async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({}); // Empty body
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('At least one limit (maxRps or dailyRequestsLimit) must be provided.');
    });

    it('should fail if maxRps is not a number (400)', async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ maxRps: 'invalid' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid value for maxRps. Must be a non-negative number.');
    });

    it('should fail if maxRps is negative (400)', async () => {
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ maxRps: -5 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid value for maxRps. Must be a non-negative number.');
    });
    
    it('should fail if dailyRequestsLimit is not a number (400)', async () => {
        const response = await request(expressApp)
          .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send({ dailyRequestsLimit: 'invalid' });
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid value for dailyRequestsLimit. Must be a non-negative number.');
    });

    it('should fail if dailyRequestsLimit is negative (400)', async () => {
        const response = await request(expressApp)
          .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send({ dailyRequestsLimit: -100 });
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid value for dailyRequestsLimit. Must be a non-negative number.');
    });

    it('should deny access if user is not an admin (401)', async () => {
      currentMockUser = { _id: ownerOfTestApp._id.toString(), isAdmin: false }; // Switch to non-admin
      const response = await request(expressApp)
        .put(`/api/v1/admin/apps/${testAppForLimits._id}/limits`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ maxRps: 100 });
      expect(response.status).toBe(401);
    });
  });
});
