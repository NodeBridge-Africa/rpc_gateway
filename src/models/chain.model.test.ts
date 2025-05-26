import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Chain, { IChain } from './chain.model';

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

describe('Chain Model', () => {
  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  it('should create a chain with default values', async () => {
    const chainData = {
      chainName: 'TestChain',
      chainId: '123',
    };
    const chain = new Chain(chainData);
    await chain.save();

    expect(chain._id).toBeDefined();
    expect(chain.isEnabled).toBe(true);
    expect(chain.description).toBeUndefined();
  });

  it('should require chainName and chainId', async () => {
    let error: any;
    try {
      const chain = new Chain({ description: 'Missing fields' });
      await chain.save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.chainName).toBeDefined();
    expect(error.errors.chainId).toBeDefined();
  });

  it('chainName should be unique', async () => {
    const chainData1 = { chainName: 'UniqueChain', chainId: '1' };
    await new Chain(chainData1).save();

    const chainData2 = { chainName: 'UniqueChain', chainId: '2' };
    let error;
    try {
      await new Chain(chainData2).save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    // @ts-ignore
    expect(error.code).toBe(11000); // MongoDB duplicate key error
    // @ts-ignore
    expect(error.keyPattern.chainName).toBe(1);
  });

  it('chainId should be unique', async () => {
    const chainData1 = { chainName: 'Chain1', chainId: 'uniqueId' };
    await new Chain(chainData1).save();

    const chainData2 = { chainName: 'Chain2', chainId: 'uniqueId' };
    let error;
    try {
      await new Chain(chainData2).save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    // @ts-ignore
    expect(error.code).toBe(11000); // MongoDB duplicate key error
    // @ts-ignore
    expect(error.keyPattern.chainId).toBe(1);
  });

  it('should correctly set optional description and isEnabled', async () => {
    const chainDescription = 'This is a test description.';
    const chain = new Chain({
      chainName: 'DescChain',
      chainId: '321',
      description: chainDescription,
      isEnabled: false,
    });
    await chain.save();
    expect(chain.description).toBe(chainDescription);
    expect(chain.isEnabled).toBe(false);
  });

  it('should have timestamps (createdAt, updatedAt)', async () => {
    const chain = new Chain({
      chainName: 'TimestampChain',
      chainId: '654',
    });
    await chain.save();

    expect(chain.createdAt).toBeDefined();
    expect(chain.updatedAt).toBeDefined();

    const initialUpdatedAt = chain.updatedAt;
    chain.description = 'Updated description';
    await chain.save();
    expect(chain.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
  });
});
