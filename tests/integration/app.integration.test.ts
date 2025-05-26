import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import User, { IUser } from '../../src/models/user.model';
import App from '../../src/models/app.model';
import Chain, { IChain } from '../../src/models/chain.model';
import DefaultAppSettings from '../../src/models/defaultAppSettings.model'; // Import DefaultAppSettings
import appRoutes from '../../src/routes/app.routes'; // The router for /api/v1/apps
import adminDefaultSettingsRoutes from '../../src/routes/defaultAppSettings.routes'; // For setting defaults
import { MongoMemoryServer } from 'mongodb-memory-server'; // For in-memory DB
import jwt from 'jsonwebtoken'; // To generate mock JWT tokens

// Mocking the auth middleware
jest.mock('../../src/auth/auth', () => ({
  auth: (req: any, res: any, next: any) => {
    // Simulate an authenticated user for testing
    // The actual token verification is skipped; we directly attach a user object
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer testtoken')) {
      req.user = { _id: new mongoose.Types.ObjectId(mockUserId) }; // mockUserId will be defined in tests
      return next();
    }
    // If no token or wrong token, simulate unauthenticated
    // For some tests, we might want to explicitly test unauthenticated by not setting the header
    return res.status(401).json({ message: 'Unauthorized from mock' });
  },
}));


let mockUserId: string;
let testUserToken: string;

const setupExpressApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/v1/apps', appRoutes); // Mount the app routes for app creation
  // Mount admin routes for default settings to allow setup in tests
  testApp.use('/api/v1/admin/settings/app-defaults', adminDefaultSettingsRoutes); 
  
  // Global error handler for any unhandled errors during tests
  testApp.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error in test app:", err);
    res.status(500).json({ message: "Internal server error in test app" });
  });
  return testApp;
};

let mongoServer: MongoMemoryServer;
let expressApp: express.Application;

describe('App Routes Integration Tests (/api/v1/apps)', () => {
  let testUser: IUser;
  let enabledChain: IChain;
  let disabledChain: IChain;
  let adminUserTokenForSetup: string; // Token for admin user to set up DefaultAppSettings

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    expressApp = setupExpressApp();

    // Create a test user for app creation
    testUser = new User({ email: 'app-test-user@example.com', password: 'password123' });
    await testUser.save();
    mockUserId = testUser._id.toString(); // Used by the mock auth middleware for normal user
    testUserToken = 'testtoken'; // Corresponds to the normal user in mock

    // Create an admin user for setting up DefaultAppSettings
    // Note: The auth mock needs to handle this admin token if it's different
    // For simplicity, if your mock auth treats any 'Bearer testtoken' as the mockUserId,
    // we might need a more sophisticated mock or ensure the admin setup call can pass.
    // Let's assume the mock auth can be temporarily bypassed or accept an admin token.
    // Or, the mock auth is enhanced to check a flag on the user.
    // For this test, the DefaultAppSettings routes are protected by the same 'auth' mock.
    // We will need to ensure 'mockUserId' can act as admin for setup.
    // This is a simplification. In a real scenario, admin auth would be distinct.
    // Let's create a separate admin user and token for clarity, assuming the mock can handle it.
    const adminUser = new User({ email: 'admin-for-apptest@example.com', password: 'adminpassword' });
    await adminUser.save();
    // This admin token will be used for setting default app settings.
    // The mock auth needs to be flexible enough or we use a different mock for admin routes.
    // For now, we'll assume the mock auth has a way to identify admin or we set mockUserId to admin for setup.
    adminUserTokenForSetup = jwt.sign({ id: adminUser._id, email: adminUser.email, isAdmin: true }, 'admin-secret');
    // The mock needs to recognize this token or a flag.
    // For the purpose of this test, we'll set the DefaultAppSettings directly or use an admin-like call.

    // Create prerequisite chains
    enabledChain = new Chain({ name: 'Enabled Test Chain', chainId: '77701', isEnabled: true });
    await enabledChain.save();
    disabledChain = new Chain({ name: 'Disabled Test Chain', chainId: '77702', isEnabled: false });
    await disabledChain.save();
  });

  afterEach(async () => {
    await App.deleteMany({});
    await DefaultAppSettings.deleteMany({}); // Clean up default settings
  });

  afterAll(async () => {
    await User.deleteMany({}); // This will remove both testUser and adminUser
    await Chain.deleteMany({});
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('POST /api/v1/apps', () => {
    it('should create an app successfully with valid data and return 201', async () => {
      const appData = {
        name: 'My New Awesome App',
        description: 'This is a test app.',
        chainName: enabledChain.name,
        chainId: enabledChain.chainId,
      };

      const response = await request(expressApp)
        .post('/api/v1/apps')
        .set('Authorization', `Bearer testtoken`)
        .send(appData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('App created successfully.');
      expect(response.body.data.app).toBeDefined();
      expect(response.body.data.app.name).toBe(appData.name);
      expect(response.body.data.app.userId.toString()).toBe(testUser._id.toString());
      expect(response.body.data.app.chainName).toBe(appData.chainName);
      expect(response.body.data.app.chainId).toBe(appData.chainId);
      expect(response.body.data.app.apiKey).toBeDefined(); 
      // Verify limits match DefaultAppSettings
      const defaultSettings = await DefaultAppSettings.findOne();
      expect(response.body.data.app.maxRps).toBe(defaultSettings?.defaultMaxRps);
      expect(response.body.data.app.dailyRequestsLimit).toBe(defaultSettings?.defaultDailyRequestsLimit);
    });

    it('should create an app with fallback defaults if DefaultAppSettings are not set', async () => {
      await DefaultAppSettings.deleteMany({}); // Ensure no settings exist
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const appData = {
        name: 'App With Fallback Limits',
        description: 'Testing fallback defaults.',
        chainName: enabledChain.name,
        chainId: enabledChain.chainId,
      };

      const response = await request(expressApp)
        .post('/api/v1/apps')
        .set('Authorization', `Bearer ${testUserToken}`) // Use normal user token
        .send(appData);

      expect(response.status).toBe(201);
      expect(response.body.data.app.maxRps).toBe(20); // Expected fallback
      expect(response.body.data.app.dailyRequestsLimit).toBe(10000); // Expected fallback
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'DefaultAppSettings not found. Falling back to environment/hardcoded defaults for new app.'
      );
      consoleWarnSpy.mockRestore();
    });


    it('should fail if name is missing (400)', async () => {
      const appData = { chainName: enabledChain.name, chainId: enabledChain.chainId };
      const response = await request(expressApp)
        .post('/api/v1/apps')
        .set('Authorization', `Bearer testtoken`)
        .send(appData);
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing required fields');
    });
    
    it('should fail if chainName is missing (400)', async () => {
        const appData = { name: "Test app", chainId: enabledChain.chainId };
        const response = await request(expressApp)
          .post('/api/v1/apps')
          .set('Authorization', `Bearer testtoken`)
          .send(appData);
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Missing required fields');
    });

    it('should fail if chainId is missing (400)', async () => {
        const appData = { name: "Test app", chainName: enabledChain.name };
        const response = await request(expressApp)
          .post('/api/v1/apps')
          .set('Authorization', `Bearer testtoken`)
          .send(appData);
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Missing required fields');
    });

    it('should fail if user tries to create more than MAX_APPS_PER_USER (5) apps (403)', async () => {
      const MAX_APPS_PER_USER = 5; // Should match controller
      // Set default settings first to ensure app creation doesn't fail due to that
      await DefaultAppSettings.findOneAndUpdate({}, { defaultMaxRps: 10, defaultDailyRequestsLimit: 100 }, { upsert: true, new: true });

      for (let i = 0; i < MAX_APPS_PER_USER; i++) {
        await new App({
          name: `App ${i + 1}`,
          userId: testUser._id,
          chainName: enabledChain.name,
          chainId: enabledChain.chainId,
          maxRps: 10, // Required
          dailyRequestsLimit: 100, // Required
        }).save();
      }

      const appData = { name: 'Excess App', chainName: enabledChain.name, chainId: enabledChain.chainId };
      const response = await request(expressApp)
        .post('/api/v1/apps')
        .set('Authorization', `Bearer testtoken`)
        .send(appData);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain(`User cannot create more than ${MAX_APPS_PER_USER} apps.`);
    });

    it('should fail if chainName/chainId does not exist (404)', async () => {
      const appData = { name: 'App With Invalid Chain', chainName: 'NonExistentChain', chainId: '000' };
      const response = await request(expressApp)
        .post('/api/v1/apps')
        .set('Authorization', `Bearer testtoken`)
        .send(appData);
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found or is not enabled');
    });

    it('should fail if chain is disabled (404)', async () => {
      const appData = { name: 'App With Disabled Chain', chainName: disabledChain.name, chainId: disabledChain.chainId };
      const response = await request(expressApp)
        .post('/api/v1/apps')
        .set('Authorization', `Bearer testtoken`)
        .send(appData);
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found or is not enabled');
    });

    it('should return 401/403 if user is not authenticated', async () => {
      const appData = { name: 'App By Unauth User', chainName: enabledChain.name, chainId: enabledChain.chainId };
      const response = await request(expressApp)
        .post('/api/v1/apps')
        // No Authorization header
        .send(appData);
      expect(response.status).toBe(401); // Based on our mock auth
      expect(response.body.message).toContain('Unauthorized from mock');
    });
  });

  describe('GET /api/v1/apps', () => {
    beforeEach(async () => {
      // Set default app settings that would apply to apps if created
      await DefaultAppSettings.findOneAndUpdate(
        {}, 
        { defaultMaxRps: 25, defaultDailyRequestsLimit: 12000 }, 
        { upsert: true, new: true }
      );

      // Create some apps for the testUser, now including required limit fields
      await new App({ 
        name: 'UserApp1', 
        userId: testUser._id, 
        chainName: enabledChain.name, 
        chainId: enabledChain.chainId, 
        apiKey: "key1",
        maxRps: 25, // From default settings or specific if needed
        dailyRequestsLimit: 12000 
      }).save();
      await new App({ 
        name: 'UserApp2', 
        userId: testUser._id, 
        chainName: enabledChain.name, 
        chainId: enabledChain.chainId, 
        apiKey: "key2",
        maxRps: 25,
        dailyRequestsLimit: 12000
      }).save();
      
      // Create an app for another user (should not be listed)
      const otherUser = new User({ email: 'other@example.com', password: 'password' });
      await otherUser.save();
      await new App({ 
        name: 'OtherUserApp', 
        userId: otherUser._id, 
        chainName: enabledChain.name, 
        chainId: enabledChain.chainId, 
        apiKey: "key3",
        maxRps: 25,
        dailyRequestsLimit: 12000
      }).save();
    });
    
    // afterEach for User.deleteOne for 'other@example.com' is still valid if that user is created in beforeEach.
    // The global App.deleteMany in the main afterEach will clear apps.

    it('should retrieve a list of apps for the authenticated user', async () => {
      const response = await request(expressApp)
        .get('/api/v1/apps')
        .set('Authorization', `Bearer testtoken`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.apps).toBeInstanceOf(Array);
      expect(response.body.data.apps.length).toBe(2); // Only apps for testUser
      expect(response.body.data.apps[0].name).toBe('UserApp1');
      expect(response.body.data.apps[1].name).toBe('UserApp2');
    });

    it('should not include apiKey in the retrieved app list', async () => {
      const response = await request(expressApp)
        .get('/api/v1/apps')
        .set('Authorization', `Bearer testtoken`);

      expect(response.status).toBe(200);
      response.body.data.apps.forEach((app: any) => {
        expect(app.apiKey).toBeUndefined();
      });
    });

    it('should return 401/403 if user is not authenticated', async () => {
      const response = await request(expressApp)
        .get('/api/v1/apps');
        // No Authorization header

      expect(response.status).toBe(401); // Based on our mock auth
      expect(response.body.message).toContain('Unauthorized from mock');
    });
  });
});
