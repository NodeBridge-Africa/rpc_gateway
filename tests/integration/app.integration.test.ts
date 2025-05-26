import supertest from 'supertest';
import { app, createUser, loginUser, clearDatabase, App, Chain, User } from './test-setup'; // Assuming app is exported from test-setup
import { DEFAULT_APP_MAX_RPS } from '../../src/config/constants';

const request = supertest(app);

describe('App Management Flow', () => {
  let regularUserToken: string;
  let regularUserId: string;
  let adminUserToken: string;
  let chain1Id: string;
  let chain2Id: string;

  beforeAll(async () => {
    // Create admin user and login
    const admin = await createUser({ email: 'admin.app@example.com', password: 'password123', isAdmin: true });
    adminUserToken = await loginUser(request, 'admin.app@example.com', 'password123');

    // Create test chains using admin token
    const chain1Data = { chainName: 'TestChain1_App', chainId: 'TC1A', description: 'Chain for app tests' };
    const chain2Data = { chainName: 'TestChain2_App', chainId: 'TC2A', description: 'Another chain for app tests' };

    let res = await request.post('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`).send(chain1Data);
    expect(res.status).toBe(201);
    chain1Id = res.body.chainId; // Assuming response contains chainId

    res = await request.post('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`).send(chain2Data);
    expect(res.status).toBe(201);
    chain2Id = res.body.chainId;

    // Create regular user and login
    const regularUser = await createUser({ email: 'user.app@example.com', password: 'password123' });
    regularUserId = regularUser._id.toString();
    regularUserToken = await loginUser(request, 'user.app@example.com', 'password123');
  });

  afterAll(async () => {
    await clearDatabase(); // Clean up all data
  });

  describe('Create App', () => {
    it('should create an app successfully for a valid chain', async () => {
      const appData = {
        name: 'My First App',
        description: 'This is a test app.',
        chainName: 'TestChain1_App',
        chainId: chain1Id,
      };
      const res = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(appData);
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(appData.name);
      expect(res.body.chainName).toBe(appData.chainName);
      expect(res.body.chainId).toBe(appData.chainId);
      expect(res.body.apiKey).toBeDefined();
      expect(res.body.maxRps).toBe(DEFAULT_APP_MAX_RPS);

      const user = await User.findById(regularUserId);
      expect(user?.appCount).toBe(1);
    });

    it('should return 400 for a non-existent chainName', async () => {
      const appData = {
        name: 'App With Bad Chain',
        chainName: 'NonExistentChain',
        chainId: 'NEC',
      };
      const res = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(appData);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid or disabled chain');
    });
    
    it('should return 400 for a non-existent chainId', async () => {
      const appData = {
        name: 'App With Bad ChainId',
        chainName: 'TestChain1_App', // Valid name
        chainId: 'NON_EXISTENT_CHAIN_ID', // Invalid ID
      };
      const res = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(appData);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid or disabled chain');
    });

    it('should return 400 if trying to create an app for a disabled chain', async () => {
      // First, disable a chain (e.g., TestChain2_App)
      const updatedChainData = { isEnabled: false };
      await request
        .put(`/admin/chains/${chain2Id}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send(updatedChainData);
      
      const appData = {
        name: 'App For Disabled Chain',
        chainName: 'TestChain2_App',
        chainId: chain2Id,
      };
      const res = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(appData);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid or disabled chain');

      // Re-enable the chain for other tests if necessary
      await request.put(`/admin/chains/${chain2Id}`).set('Authorization', `Bearer ${adminUserToken}`).send({ isEnabled: true });
    });
  });

  describe('List Apps', () => {
    it('should list all apps for the user', async () => {
      // At this point, one app ("My First App") should exist from the previous test.
      // Let's create another one for TestChain2_App
      const appData2 = {
        name: 'My Second App',
        chainName: 'TestChain2_App',
        chainId: chain2Id,
      };
      const createRes = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(appData2);
      expect(createRes.status).toBe(201);

      const res = await request.get('/apps').set('Authorization', `Bearer ${regularUserToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2); // After 'My First App' and 'My Second App'
      expect(res.body.some((app: any) => app.name === 'My First App')).toBe(true);
      expect(res.body.some((app: any) => app.name === 'My Second App')).toBe(true);
    });
  });

  describe('App Limit', () => {
    // User already has 2 apps from previous tests. Need to create 3 more.
    // The user's appCount is currently 2 from "My First App" and "My Second App"
    // and the one created in 'should create an app successfully for a valid chain' if tests run sequentially
    // and database is not cleared between describe blocks (which it is by beforeEach in test-setup)
    // For this test, we'll ensure a clean slate for app counts or manage it carefully.
    // Let's assume beforeEach in test-setup clears apps, so we start with 0 for this user in this context if it were isolated.
    // However, user and chains persist from beforeAll.
    // To make this test robust, let's clear apps for this specific user first.
    
    beforeEach(async () => {
        // Clear apps for the regular user to ensure predictable appCount
        await App.deleteMany({ userId: regularUserId });
        const user = await User.findById(regularUserId);
        if (user) {
            user.appCount = 0;
            await user.save();
        }
    });

    it('should allow creating apps up to the limit (5)', async () => {
      for (let i = 1; i <= 5; i++) {
        const appData = {
          name: `App Limit Test ${i}`,
          chainName: i % 2 === 0 ? 'TestChain1_App' : 'TestChain2_App', // Alternate chains
          chainId: i % 2 === 0 ? chain1Id : chain2Id,
        };
        const res = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(appData);
        expect(res.status).toBe(201);
        
        const user = await User.findById(regularUserId);
        expect(user?.appCount).toBe(i);
      }
    });

    it('should return 403 when trying to create the 6th app', async () => {
      // First, ensure 5 apps are created
      for (let i = 1; i <= 5; i++) {
        await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send({
          name: `App ${i}`,
          chainName: 'TestChain1_App',
          chainId: chain1Id,
        });
      }
      
      const userBefore6th = await User.findById(regularUserId);
      expect(userBefore6th?.appCount).toBe(5);

      const appData6 = {
        name: 'The Sixth App',
        chainName: 'TestChain1_App',
        chainId: chain1Id,
      };
      const res = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(appData6);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('App limit reached. Maximum 5 apps allowed.');
      
      const userAfter6thAttempt = await User.findById(regularUserId);
      expect(userAfter6thAttempt?.appCount).toBe(5); // Should not have incremented
    });
  });
});
