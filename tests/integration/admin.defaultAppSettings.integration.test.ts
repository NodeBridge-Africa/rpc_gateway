import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import User from '../../src/models/user.model';
import DefaultAppSettings from '../../src/models/defaultAppSettings.model';
import defaultAppSettingsRoutes from '../../src/routes/defaultAppSettings.routes';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Mocking auth middleware
let currentMockUser: { _id: string, isAdmin?: boolean } | null = null;
jest.mock('../../src/auth/auth', () => ({
  auth: (req: any, res: any, next: any) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer admin-testtoken') && currentMockUser?.isAdmin) {
      req.user = { _id: new mongoose.Types.ObjectId(currentMockUser._id), isAdmin: true };
      return next();
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer user-testtoken') && currentMockUser && !currentMockUser.isAdmin) {
      req.user = { _id: new mongoose.Types.ObjectId(currentMockUser._id), isAdmin: false };
      return next();
    }
    return res.status(401).json({ message: 'Unauthorized from defaultAppSettings mock' });
  },
}));

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  // Mount routes under the path they are registered in the main app.ts
  testApp.use('/api/v1/admin/settings/app-defaults', defaultAppSettingsRoutes); 
  
  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in defaultAppSettings test app:", err);
    res.status(500).json({ message: "Internal server error in defaultAppSettings test app" });
  });
  return testApp;
};

let mongoServer: MongoMemoryServer;
let expressApp: express.Application;
let adminUserToken: string;
let regularUserToken: string;
let adminUserId: string;

describe('Admin Default App Settings Integration Tests (/api/v1/admin/settings/app-defaults)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    expressApp = setupExpressApp();

    const adminUser = new User({ email: 'admin-das@example.com', password: 'password123' });
    await adminUser.save();
    adminUserId = adminUser._id.toString();
    adminUserToken = 'admin-testtoken';

    const regularUser = new User({ email: 'user-das@example.com', password: 'password123' });
    await regularUser.save();
    regularUserToken = 'user-testtoken'; // currentMockUser will be set to this user ID for non-admin tests
  });

  beforeEach(async () => {
    await DefaultAppSettings.deleteMany({});
    // Default to admin user for most tests
    currentMockUser = { _id: adminUserId, isAdmin: true };
  });

  afterAll(async () => {
    await User.deleteMany({});
    await DefaultAppSettings.deleteMany({});
    await mongoose.disconnect();
    await mongoServer.stop();
    currentMockUser = null;
  });

  describe('GET /api/v1/admin/settings/app-defaults', () => {
    it('should return initial default settings (20 RPS, 10000 daily) if none are in DB', async () => {
      const response = await request(expressApp)
        .get('/api/v1/admin/settings/app-defaults')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings.defaultMaxRps).toBe(20);
      expect(response.body.data.settings.defaultDailyRequestsLimit).toBe(10000);
    });

    it('should return existing settings if they are already in the DB', async () => {
      await new DefaultAppSettings({ defaultMaxRps: 30, defaultDailyRequestsLimit: 15000 }).save();
      
      const response = await request(expressApp)
        .get('/api/v1/admin/settings/app-defaults')
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.settings.defaultMaxRps).toBe(30);
      expect(response.body.data.settings.defaultDailyRequestsLimit).toBe(15000);
    });

    it('should deny access to non-admin users (401)', async () => {
      currentMockUser = { _id: (await User.findOne({email: 'user-das@example.com'}))!._id.toString(), isAdmin: false };
      const response = await request(expressApp)
        .get('/api/v1/admin/settings/app-defaults')
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/admin/settings/app-defaults', () => {
    it('should successfully update defaultMaxRps and defaultDailyRequestsLimit', async () => {
      const updates = { defaultMaxRps: 75, defaultDailyRequestsLimit: 25000 };
      const response = await request(expressApp)
        .put('/api/v1/admin/settings/app-defaults')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings.defaultMaxRps).toBe(updates.defaultMaxRps);
      expect(response.body.data.settings.defaultDailyRequestsLimit).toBe(updates.defaultDailyRequestsLimit);

      const dbSettings = await DefaultAppSettings.findOne();
      expect(dbSettings?.defaultMaxRps).toBe(updates.defaultMaxRps);
    });

    it('should correctly create settings if none exist (upsert)', async () => {
      const initialCount = await DefaultAppSettings.countDocuments();
      expect(initialCount).toBe(0);

      const updates = { defaultMaxRps: 60, defaultDailyRequestsLimit: 12000 };
      const response = await request(expressApp)
        .put('/api/v1/admin/settings/app-defaults')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send(updates);
      
      expect(response.status).toBe(200);
      const finalCount = await DefaultAppSettings.countDocuments();
      expect(finalCount).toBe(1);
      expect(response.body.data.settings.defaultMaxRps).toBe(updates.defaultMaxRps);
    });

    it('should fail if defaultMaxRps is missing (400)', async () => {
      const response = await request(expressApp)
        .put('/api/v1/admin/settings/app-defaults')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ defaultDailyRequestsLimit: 20000 });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Both defaultMaxRps and defaultDailyRequestsLimit must be numbers and are required.');
    });
    
    it('should fail if defaultDailyRequestsLimit is missing (400)', async () => {
        const response = await request(expressApp)
          .put('/api/v1/admin/settings/app-defaults')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send({ defaultMaxRps: 50 });
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Both defaultMaxRps and defaultDailyRequestsLimit must be numbers and are required.');
      });


    it('should fail if defaultMaxRps is not a number (400)', async () => {
      const response = await request(expressApp)
        .put('/api/v1/admin/settings/app-defaults')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ defaultMaxRps: 'invalid', defaultDailyRequestsLimit: 20000 });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Both defaultMaxRps and defaultDailyRequestsLimit must be numbers and are required.');
    });
    
    it('should fail if defaultMaxRps is negative (400)', async () => {
        const response = await request(expressApp)
          .put('/api/v1/admin/settings/app-defaults')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send({ defaultMaxRps: -5, defaultDailyRequestsLimit: 20000 });
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Values for defaultMaxRps and defaultDailyRequestsLimit cannot be negative.');
      });

    it('should deny access to non-admin users (401)', async () => {
      currentMockUser = { _id: (await User.findOne({email: 'user-das@example.com'}))!._id.toString(), isAdmin: false };
      const response = await request(expressApp)
        .put('/api/v1/admin/settings/app-defaults')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ defaultMaxRps: 50, defaultDailyRequestsLimit: 10000 });
      expect(response.status).toBe(401);
    });
  });
});
