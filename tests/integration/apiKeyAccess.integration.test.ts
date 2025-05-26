import supertest from 'supertest';
import { app, createUser, loginUser, clearDatabase, App, Chain } from './test-setup';
import { apiKeyGuard } from '../../src/middlewares/apiKey.middleware';
import { dynamicRateLimit } from '../../src/middlewares/rateLimit.middleware';
import { Request, Response } from 'express';
import { IApp } from '../../src/models/app.model';

const request = supertest(app);

// Define a type for our mock request that includes 'app'
interface TestProxyRequest extends Request {
  app?: IApp;
  apiKey?: string;
}

// Setup a test route within the app for these tests
// This route will be protected by apiKeyGuard and dynamicRateLimit
app.get('/test-proxy/:key/:targetChain', apiKeyGuard, dynamicRateLimit, (req: TestProxyRequest, res: Response) => {
  if (!req.app) {
    // This case should ideally be handled by apiKeyGuard returning an error before this point
    return res.status(500).json({ message: 'App details not found on request' });
  }
  res.status(200).json({
    message: 'Proxy test successful',
    appName: req.app.name,
    appApiKey: req.app.apiKey,
    requestedChain: req.params.targetChain,
    appChainName: req.app.chainName, // The chain the app is configured for
    maxRps: req.app.maxRps,
    dailyRequests: req.app.dailyRequests, // For daily limit testing
  });
});


describe('API Key Access, Rate Limiting & Proxying Simulation', () => {
  let adminUserToken: string;
  let regularUserToken: string;
  let regularUserId: string;
  let proxyTestChain: any;
  let app1: any;
  let app1ApiKey: string;
  let app2: any;
  let app2ApiKey: string;

  const app1MaxRps = 5;
  const app2MaxRps = 3;

  beforeAll(async () => {
    // Admin setup
    await createUser({ email: 'admin.proxy@example.com', password: 'password123', isAdmin: true });
    adminUserToken = await loginUser(request, 'admin.proxy@example.com', 'password123');

    // Create ProxyTestChain
    const chainRes = await request.post('/admin/chains')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .send({ chainName: 'ProxyTestChain', chainId: 'PTC1', description: 'Chain for proxy tests' });
    expect(chainRes.status).toBe(201);
    proxyTestChain = chainRes.body;

    // Regular user setup
    const user = await createUser({ email: 'user.proxy@example.com', password: 'password123' });
    regularUserId = user._id.toString();
    regularUserToken = await loginUser(request, 'user.proxy@example.com', 'password123');

    // Create App 1 for the regular user
    const app1Data = {
      name: 'Proxy Test App 1',
      chainName: proxyTestChain.chainName,
      chainId: proxyTestChain.chainId,
      // maxRps will be set by default, but we can override if app model/controller allows
    };
    // We need to manually set maxRps for app1 as it's not part of createApp controller logic
    // So, we'll create it then update it, or rely on default + update for test
    const app1Res = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(app1Data);
    expect(app1Res.status).toBe(201);
    app1 = app1Res.body;
    app1ApiKey = app1.apiKey;
    // Manually update maxRps in DB for app1 for this test
    await App.findByIdAndUpdate(app1._id, { maxRps: app1MaxRps });
    app1.maxRps = app1MaxRps; // update local copy

    // Create App 2 for the same user
    const app2Data = {
      name: 'Proxy Test App 2',
      chainName: proxyTestChain.chainName,
      chainId: proxyTestChain.chainId,
    };
    const app2Res = await request.post('/apps').set('Authorization', `Bearer ${regularUserToken}`).send(app2Data);
    expect(app2Res.status).toBe(201);
    app2 = app2Res.body;
    app2ApiKey = app2.apiKey;
    await App.findByIdAndUpdate(app2._id, { maxRps: app2MaxRps });
    app2.maxRps = app2MaxRps;
  });

  afterAll(async () => {
    await clearDatabase();
  });
  
  beforeEach(async () => {
    // Reset request counters for apps before each specific API access test
    // but not their fundamental properties like API keys or maxRps
    await App.findByIdAndUpdate(app1._id, { requests: 0, dailyRequests: 0, lastResetDate: new Date() });
    await App.findByIdAndUpdate(app2._id, { requests: 0, dailyRequests: 0, lastResetDate: new Date() });
     // Clear rate limit buckets by simulating time passing (jest fake timers are per file)
     // This is a bit of a hack. A better way would be to export and clear the buckets object from rateLimit.middleware
     jest.useFakeTimers();
     jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 1); // Advance > 1 day to clear old buckets
     // dynamicRateLimit's setInterval for cleanupOldBuckets would run if we called it.
     // For now, this time advance should make existing buckets "old" if cleanup were called.
     // The rateLimit middleware itself doesn't expose a "clear all buckets" function.
     jest.useRealTimers(); // Return to real timers
  });


  describe('Valid and Invalid Key Access', () => {
    it('should allow access with a valid API key and confirm app details', async () => {
      const res = await request.get(`/test-proxy/${app1ApiKey}/${proxyTestChain.chainName}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Proxy test successful');
      expect(res.body.appApiKey).toBe(app1ApiKey);
      expect(res.body.appChainName).toBe(proxyTestChain.chainName);
      expect(res.body.requestedChain).toBe(proxyTestChain.chainName);
    });

    it('should deny access with an invalid API key', async () => {
      const res = await request.get(`/test-proxy/fake-api-key/${proxyTestChain.chainName}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Invalid or inactive API key');
    });
  });

  describe('Rate Limiting', () => {
    it(`should allow requests up to app.maxRps (${app1MaxRps}) and block subsequent ones`, async () => {
      for (let i = 1; i <= app1MaxRps; i++) {
        const res = await request.get(`/test-proxy/${app1ApiKey}/${proxyTestChain.chainName}`);
        expect(res.status).toBe(200);
        expect(res.header['x-ratelimit-limit']).toBe(app1MaxRps.toString());
        expect(res.header['x-ratelimit-remaining']).toBe((app1MaxRps - i).toString());
      }

      const resBlocked = await request.get(`/test-proxy/${app1ApiKey}/${proxyTestChain.chainName}`);
      expect(resBlocked.status).toBe(429);
      expect(resBlocked.body.error).toBe('Rate limit exceeded');
      expect(resBlocked.header['x-ratelimit-remaining']).toBe('0');
    });

    it('should have correct X-RateLimit headers', async () => {
        const res = await request.get(`/test-proxy/${app1ApiKey}/${proxyTestChain.chainName}`);
        expect(res.status).toBe(200);
        expect(res.header['x-ratelimit-limit']).toBe(app1MaxRps.toString());
        expect(res.header['x-ratelimit-remaining']).toBe((app1MaxRps - 1).toString());
        expect(res.header['x-ratelimit-reset']).toBeDefined();
      });
  });
  
  describe('Independent Rate Limiting for Different Apps', () => {
     it('should rate limit apps independently', async () => {
      // Exhaust app1's rate limit
      for (let i = 1; i <= app1MaxRps; i++) {
        await request.get(`/test-proxy/${app1ApiKey}/${proxyTestChain.chainName}`);
      }
      const resApp1Blocked = await request.get(`/test-proxy/${app1ApiKey}/${proxyTestChain.chainName}`);
      expect(resApp1Blocked.status).toBe(429);

      // App2 should still be accessible
      const resApp2Allowed = await request.get(`/test-proxy/${app2ApiKey}/${proxyTestChain.chainName}`);
      expect(resApp2Allowed.status).toBe(200);
      expect(resApp2Allowed.header['x-ratelimit-limit']).toBe(app2MaxRps.toString());
      expect(resApp2Allowed.header['x-ratelimit-remaining']).toBe((app2MaxRps - 1).toString());

      // Exhaust app2's rate limit
       for (let i = 1; i <= app2MaxRps -1; i++) { // -1 because one request already made above
        await request.get(`/test-proxy/${app2ApiKey}/${proxyTestChain.chainName}`);
      }
      const resApp2Blocked = await request.get(`/test-proxy/${app2ApiKey}/${proxyTestChain.chainName}`);
      expect(resApp2Blocked.status).toBe(429);
    });
  });

  describe('Daily Request Limit', () => {
    const dailyLimit = parseInt(process.env.DEFAULT_DAILY_REQUESTS || '10000');

    it('should block requests if daily limit is exceeded', async () => {
      // Simulate app having reached its daily limit
      await App.findByIdAndUpdate(app1._id, { dailyRequests: dailyLimit });
      
      const res = await request.get(`/test-proxy/${app1ApiKey}/${proxyTestChain.chainName}`);
      // The findOneAndUpdate in apiKeyGuard increments dailyRequests BEFORE checking the limit.
      // So, if dailyRequests was already AT the limit, it becomes limit + 1, then gets blocked.
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Daily request limit exceeded');

      // Verify counter was incremented (even though blocked)
      const dbApp = await App.findById(app1._id);
      expect(dbApp?.dailyRequests).toBe(dailyLimit + 1); 
    });
    
    it('should allow request if daily limit is not exceeded', async () => {
      await App.findByIdAndUpdate(app1._id, { dailyRequests: dailyLimit -1 });
      const res = await request.get(`/test-proxy/${app1ApiKey}/${proxyTestChain.chainName}`);
      expect(res.status).toBe(200);
      const dbApp = await App.findById(app1._id);
      expect(dbApp?.dailyRequests).toBe(dailyLimit); 
    });
  });
});
