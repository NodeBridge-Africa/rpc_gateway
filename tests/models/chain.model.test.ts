import mongoose from 'mongoose';
import Chain, { IChain } from '../../src/models/chain.model';

// Utility to connect to a test database (reuse or adapt from app.model.test.ts)
const connectTestDB = async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/test_db_chain_model');
    } catch (err) {
      console.error('Failed to connect to test MongoDB for Chain model', err);
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

describe('Chain Model Unit Tests', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await Chain.deleteMany({});
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe('CRUD Operations', () => {
    it('should create and save a chain successfully', async () => {
      const chainData = {
        name: 'Test Ethereum Chain',
        chainId: '1',
        isEnabled: true,
        adminNotes: 'Mainnet for testing',
      };
      const chain = new Chain(chainData);
      const savedChain = await chain.save();

      expect(savedChain._id).toBeDefined();
      expect(savedChain.name).toBe(chainData.name);
      expect(savedChain.chainId).toBe(chainData.chainId);
      expect(savedChain.isEnabled).toBe(chainData.isEnabled);
      expect(savedChain.adminNotes).toBe(chainData.adminNotes);
      expect(savedChain.createdAt).toBeDefined();
      expect(savedChain.updatedAt).toBeDefined();
    });

    it('should read a chain successfully', async () => {
      const chainData = { name: 'Sepolia Testnet', chainId: '11155111' };
      const chain = new Chain(chainData);
      await chain.save();

      const foundChain = await Chain.findById(chain._id);
      expect(foundChain).toBeDefined();
      expect(foundChain?.name).toBe(chainData.name);
      expect(foundChain?.chainId).toBe(chainData.chainId);
    });

    it('should update a chain successfully', async () => {
        const chain = new Chain({ name: 'Old Chain Name', chainId: '777' });
        await chain.save();

        chain.name = 'New Chain Name';
        chain.isEnabled = false;
        const updatedChain = await chain.save();

        expect(updatedChain.name).toBe('New Chain Name');
        expect(updatedChain.isEnabled).toBe(false);
    });

    it('should delete a chain successfully', async () => {
        const chain = new Chain({ name: 'To Be Deleted', chainId: '999' });
        await chain.save();
        
        await Chain.deleteOne({ _id: chain._id });
        const deletedChain = await Chain.findById(chain._id);
        expect(deletedChain).toBeNull();
    });
  });

  describe('Validations', () => {
    it('should fail if name is missing', async () => {
      const chain = new Chain({ chainId: '123' });
      let err;
      try {
        await chain.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.name).toBeDefined();
    });

    it('should fail if chainId is missing', async () => {
      const chain = new Chain({ name: 'Test Chain No ID' });
      let err;
      try {
        await chain.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect((err as mongoose.Error.ValidationError).errors.chainId).toBeDefined();
    });

    it('should enforce uniqueness for name', async () => {
      await new Chain({ name: 'UniqueNameChain', chainId: '100' }).save();
      const duplicateChain = new Chain({ name: 'UniqueNameChain', chainId: '101' });
      let err;
      try {
        await duplicateChain.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      // MongoDB duplicate key error code is 11000
      expect((err as any).code).toBe(11000); 
    });

    it('should enforce uniqueness for chainId', async () => {
      await new Chain({ name: 'ChainA', chainId: '200' }).save();
      const duplicateChain = new Chain({ name: 'ChainB', chainId: '200' });
      let err;
      try {
        await duplicateChain.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect((err as any).code).toBe(11000);
    });
  });

  describe('Defaults', () => {
    it('should default isEnabled to true if not provided', async () => {
      const chain = new Chain({ name: 'DefaultEnabledChain', chainId: '300' });
      await chain.save();
      expect(chain.isEnabled).toBe(true);
    });

    it('should accept isEnabled as false if provided', async () => {
      const chain = new Chain({ name: 'ExplicitlyDisabledChain', chainId: '301', isEnabled: false });
      await chain.save();
      expect(chain.isEnabled).toBe(false);
    });
  });
});
