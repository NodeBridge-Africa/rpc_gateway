import mongoose from 'mongoose';
import DefaultAppSettings, { IDefaultAppSettings } from '../../src/models/defaultAppSettings.model';

// Utility to connect to a test database (reuse or adapt as needed)
const connectTestDB = async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      // Ensure this URI is configured for your test environment
      await mongoose.connect(process.env.MONGO_URI_TEST_DAS || 'mongodb://localhost:27017/test_db_default_app_settings');
    } catch (err) {
      console.error('Failed to connect to test MongoDB for DefaultAppSettings model', err);
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

describe('DefaultAppSettings Model Unit Tests', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await DefaultAppSettings.deleteMany({});
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe('Creation and Update', () => {
    it('should create and save DefaultAppSettings successfully', async () => {
      const settingsData: Partial<IDefaultAppSettings> = {
        defaultMaxRps: 50,
        defaultDailyRequestsLimit: 20000,
      };
      const settings = new DefaultAppSettings(settingsData);
      const savedSettings = await settings.save();

      expect(savedSettings._id).toBeDefined();
      expect(savedSettings.defaultMaxRps).toBe(settingsData.defaultMaxRps);
      expect(savedSettings.defaultDailyRequestsLimit).toBe(settingsData.defaultDailyRequestsLimit);
      expect(savedSettings.createdAt).toBeDefined();
      expect(savedSettings.updatedAt).toBeDefined();
    });

    it('should update existing DefaultAppSettings successfully', async () => {
      const initialSettings = new DefaultAppSettings({ defaultMaxRps: 30, defaultDailyRequestsLimit: 15000 });
      await initialSettings.save();

      initialSettings.defaultMaxRps = 60;
      initialSettings.defaultDailyRequestsLimit = 25000;
      const updatedSettings = await initialSettings.save();

      expect(updatedSettings.defaultMaxRps).toBe(60);
      expect(updatedSettings.defaultDailyRequestsLimit).toBe(25000);
    });
  });

  describe('Validations', () => {
    it('should fail if defaultMaxRps is missing', async () => {
      const settings = new DefaultAppSettings({ defaultDailyRequestsLimit: 10000 });
      let err;
      try {
        await settings.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.defaultMaxRps).toBeDefined();
    });

    it('should fail if defaultDailyRequestsLimit is missing', async () => {
      const settings = new DefaultAppSettings({ defaultMaxRps: 50 });
      let err;
      try {
        await settings.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.defaultDailyRequestsLimit).toBeDefined();
    });

    it('should fail if defaultMaxRps is not a number', async () => {
      const settings = new DefaultAppSettings({
        defaultMaxRps: 'not-a-number' as any,
        defaultDailyRequestsLimit: 10000,
      });
      let err;
      try {
        await settings.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.defaultMaxRps).toBeDefined();
    });

    it('should fail if defaultDailyRequestsLimit is not a number', async () => {
      const settings = new DefaultAppSettings({
        defaultMaxRps: 50,
        defaultDailyRequestsLimit: 'not-a-number' as any,
      });
      let err;
      try {
        await settings.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.defaultDailyRequestsLimit).toBeDefined();
    });
  });
});
