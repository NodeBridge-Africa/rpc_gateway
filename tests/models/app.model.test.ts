import mongoose, { Types } from 'mongoose';
import App, { IApp } from '../../src/models/app.model';
import User from '../../src/models/user.model'; // Needed for userId reference

// Utility to connect to a test database (replace with your actual test DB setup)
const connectTestDB = async () => {
  // For local testing, you might use something like:
  // const uri = 'mongodb://localhost:27017/test_db_app_model';
  // For CI or more complex setups, use environment variables or a helper.
  if (mongoose.connection.readyState === 0) {
    // Using a generic in-memory MongoDB server for tests if available
    // Or connect to a specific test instance
    // This part is highly dependent on your existing test setup
    // For now, this is a placeholder
    try {
      await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/test_db_app_model');
    } catch (err) {
      console.error('Failed to connect to test MongoDB', err);
      process.exit(1);
    }
  }
};

const disconnectTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
};

describe('App Model Unit Tests', () => {
  let testUser: any;

  beforeAll(async () => {
    await connectTestDB();
    // Create a dummy user for app ownership
    testUser = new User({ email: 'testuser@example.com', password: 'password123' });
    await testUser.save();
  });

  afterEach(async () => {
    await App.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await disconnectTestDB();
  });

  describe('CRUD Operations', () => {
    it('should create and save an app successfully', async () => {
      const appData = {
        name: 'Test App',
        userId: testUser._id,
        chainName: 'TestChain',
        chainId: '0x123',
        maxRps: 10, // Provide explicit value as it's now required
        dailyRequestsLimit: 1000, // Provide explicit value as it's now required
      };
      const app = new App(appData);
      const savedApp = await app.save();

      expect(savedApp._id).toBeDefined();
      expect(savedApp.name).toBe(appData.name);
      expect(savedApp.userId.toString()).toBe(testUser._id.toString());
      expect(savedApp.chainName).toBe(appData.chainName);
      expect(savedApp.chainId).toBe(appData.chainId);
      expect(savedApp.apiKey).toBeDefined();
      expect(savedApp.maxRps).toBe(appData.maxRps); // Check against provided value
      expect(savedApp.dailyRequestsLimit).toBe(appData.dailyRequestsLimit); // Check against provided value
      expect(savedApp.requests).toBe(0);
      expect(savedApp.dailyRequests).toBe(0);
      expect(savedApp.isActive).toBe(true);
      expect(savedApp.createdAt).toBeDefined();
      expect(savedApp.updatedAt).toBeDefined();
    });

    it('should read an app successfully', async () => {
      const appData = {
        name: 'Another Test App',
        userId: testUser._id,
        chainName: 'AnotherChain',
        chainId: '0x456',
        maxRps: 15, // Provide explicit value
        dailyRequestsLimit: 1500, // Provide explicit value
      };
      const app = new App(appData);
      await app.save();

      const foundApp = await App.findById(app._id);
      expect(foundApp).toBeDefined();
      expect(foundApp?.name).toBe(appData.name);
    });
  });

  describe('Validations', () => {
    it('should fail if name is missing', async () => {
      // Missing name, but provide other required fields for this test
      const appData = { 
        userId: testUser._id, 
        chainName: 'TestChain', 
        chainId: '0x123',
        maxRps: 5,
        dailyRequestsLimit: 500
      };
      const app = new App(appData);
      let err;
      try {
        await app.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.name).toBeDefined();
    });

    it('should fail if userId is missing', async () => {
      // Missing userId, but provide other required fields
      const appData = { 
        name: 'Test App', 
        chainName: 'TestChain', 
        chainId: '0x123',
        maxRps: 5,
        dailyRequestsLimit: 500
      };
      const app = new App(appData);
      let err;
      try {
        await app.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.userId).toBeDefined();
    });
    
    it('should fail if chainName is missing', async () => {
      // Missing chainName, but provide other required fields
      const appData = { 
        name: 'Test App', 
        userId: testUser._id, 
        chainId: '0x123',
        maxRps: 5,
        dailyRequestsLimit: 500
      };
      const app = new App(appData);
      let err;
      try {
        await app.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.chainName).toBeDefined();
    });

    it('should fail if chainId is missing', async () => {
      // Missing chainId, but provide other required fields
      const appData = { 
        name: 'Test App', 
        userId: testUser._id, 
        chainName: 'TestChain',
        maxRps: 5,
        dailyRequestsLimit: 500
      };
      const app = new App(appData);
      let err;
      try {
        await app.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.chainId).toBeDefined();
    });

    it('should fail if maxRps is missing', async () => {
      const appData = {
        name: 'Test App No MaxRPS',
        userId: testUser._id,
        chainName: 'TestChain',
        chainId: '0x1',
        dailyRequestsLimit: 1000, // dailyRequestsLimit is provided
      };
      const app = new App(appData);
      let err;
      try {
        await app.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.maxRps).toBeDefined();
    });

    it('should fail if dailyRequestsLimit is missing', async () => {
      const appData = {
        name: 'Test App No DailyLimit',
        userId: testUser._id,
        chainName: 'TestChain',
        chainId: '0x2',
        maxRps: 10, // maxRps is provided
      };
      const app = new App(appData);
      let err;
      try {
        await app.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.dailyRequestsLimit).toBeDefined();
    });
    
    it('should fail if maxRps is not a number', async () => {
      const appData = {
        name: 'Test App Invalid MaxRPS',
        userId: testUser._id,
        chainName: 'TestChain',
        chainId: '0x3',
        maxRps: 'invalid' as any, // Invalid type
        dailyRequestsLimit: 1000,
      };
      const app = new App(appData);
      let err;
      try {
        await app.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.maxRps).toBeDefined();
    });

    it('should fail if dailyRequestsLimit is not a number', async () => {
      const appData = {
        name: 'Test App Invalid DailyLimit',
        userId: testUser._id,
        chainName: 'TestChain',
        chainId: '0x4',
        maxRps: 10,
        dailyRequestsLimit: 'invalid' as any, // Invalid type
      };
      const app = new App(appData);
      let err;
      try {
        await app.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.dailyRequestsLimit).toBeDefined();
    });

    it('should auto-generate an API key and ensure it is unique', async () => {
      const appData1 = { name: 'App1', userId: testUser._id, chainName: 'Chain1', chainId: '0x1', maxRps: 5, dailyRequestsLimit: 500 };
      const app1 = new App(appData1);
      await app1.save();

      const appData2 = { name: 'App2', userId: testUser._id, chainName: 'Chain2', chainId: '0x2', maxRps: 5, dailyRequestsLimit: 500 };
      const app2 = new App(appData2);
      await app2.save();

      expect(app1.apiKey).toBeDefined();
      expect(app2.apiKey).toBeDefined();
      expect(app1.apiKey).not.toBe(app2.apiKey);

      // Test uniqueness constraint (Mongoose handles this with an E11000 error)
      // This requires a bit more setup to trigger reliably without race conditions in tests
      // For now, relying on the default UUID generation and schema unique:true property.
      // A deeper test would involve trying to save an app with a pre-existing apiKey.
    });
    
    // The 'should default maxRps correctly' test is no longer relevant here as maxRps
    // is now required and its default is handled by DefaultAppSettings logic in the controller,
    // not by a Mongoose schema default based on an environment variable.
    // This test block can be removed or adapted if there's a new schema-level default behavior to test.
    // For now, let's remove it.
    /*
    it('should default maxRps correctly', async () => {
        // ... old test content ...
    });
    */
  });

  describe('Instance Methods', () => {
    describe('resetDailyRequestsIfNeeded', () => {
      it('should not reset dailyRequests or lastResetDate if called on the same day', async () => {
        const app = new App({
          name: 'Daily Reset Test App',
          userId: testUser._id,
          chainName: 'ResetChain',
          chainId: '0x789',
          maxRps: 10, // required
          dailyRequestsLimit: 1000, // required
          dailyRequests: 100,
          lastResetDate: new Date(),
        });
        await app.save();

        const initialDailyRequests = app.dailyRequests;
        const initialLastResetDate = app.lastResetDate;

        app.resetDailyRequestsIfNeeded(); // Call method
        await app.save(); // Persist changes if any

        expect(app.dailyRequests).toBe(initialDailyRequests);
        expect(app.lastResetDate.getTime()).toBe(initialLastResetDate.getTime());
      });

      it('should reset dailyRequests to 0 and update lastResetDate if called on a new day', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const app = new App({
          name: 'Daily Reset New Day Test App',
          userId: testUser._id,
          chainName: 'ResetChainNewDay',
          chainId: '0xABC',
          maxRps: 10, // required
          dailyRequestsLimit: 1000, // required
          dailyRequests: 150,
          lastResetDate: yesterday,
        });
        await app.save();
        
        expect(app.dailyRequests).toBe(150); // Verify initial state

        app.resetDailyRequestsIfNeeded(); // Call method
        await app.save(); // Persist changes

        const today = new Date();
        expect(app.dailyRequests).toBe(0);
        expect(app.lastResetDate.getDate()).toBe(today.getDate());
        expect(app.lastResetDate.getMonth()).toBe(today.getMonth());
        expect(app.lastResetDate.getFullYear()).toBe(today.getFullYear());
      });
    });
  });
});
