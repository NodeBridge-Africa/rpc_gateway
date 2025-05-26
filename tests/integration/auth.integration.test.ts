import supertest from 'supertest';
import { app, createUser, loginUser, clearDatabase, User } from './test-setup'; // Assuming app is exported from test-setup

const request = supertest(app);

describe('Authentication and User Account Flow', () => {
  
  beforeEach(async () => {
    await clearDatabase(); // Clear before each test for isolation
  });

  afterAll(async () => {
    await clearDatabase(); // Final cleanup
  });

  describe('User Registration', () => {
    it('should register a new user successfully and not return API key details', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
      };
      const res = await request.post('/auth/register').send(userData);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      
      // Check user object in response
      const userRes = res.body.data.user;
      expect(userRes.id).toBeDefined();
      expect(userRes.email).toBe(userData.email);
      expect(userRes.appCount).toBe(0); // Default value
      expect(userRes.isAdmin).toBe(false); // Default value

      // Verify no old API key fields are present
      expect(userRes.apiKey).toBeUndefined();
      expect(userRes.maxRps).toBeUndefined();
      expect(res.body.data.apiKey).toBeUndefined(); // Top-level apiKey also removed

      // Verify in DB
      const dbUser = await User.findOne({ email: userData.email });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.appCount).toBe(0);
      expect(dbUser?.isAdmin).toBe(false);
    });

    it('should return 409 if user already exists', async () => {
      await createUser({ email: 'existing@example.com', password: 'password123' });
      const res = await request.post('/auth/register').send({ email: 'existing@example.com', password: 'password456' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('User already exists with this email');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      await createUser({ email: 'loginuser@example.com', password: 'password123' });
    });

    it('should log in an existing user and not return API key details', async () => {
      const loginData = {
        email: 'loginuser@example.com',
        password: 'password123',
      };
      const res = await request.post('/auth/login').send(loginData);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();

      const userRes = res.body.data.user;
      expect(userRes.id).toBeDefined();
      expect(userRes.email).toBe(loginData.email);
      
      // Verify no old API key or usage fields are present in user object from login
      expect(userRes.apiKey).toBeUndefined();
      expect(userRes.maxRps).toBeUndefined();
      expect(userRes.requests).toBeUndefined();
      expect(userRes.dailyRequests).toBeUndefined();
      expect(res.body.data.apiKey).toBeUndefined(); // Top-level apiKey also removed
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request.post('/auth/login').send({ email: 'loginuser@example.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  describe('Get Account Information', () => {
    let userToken: string;
    let userId: string;

    beforeEach(async () => {
      const user = await createUser({ email: 'accountuser@example.com', password: 'password123', appCount: 2, isAdmin: false });
      userId = user._id.toString();
      userToken = await loginUser(request, 'accountuser@example.com', 'password123');
    });

    it('should get account information without API key details or user-specific endpoints', async () => {
      const res = await request.get('/auth/account').set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const userRes = res.body.data.user;
      expect(userRes.id).toBe(userId);
      expect(userRes.email).toBe('accountuser@example.com');
      expect(userRes.appCount).toBe(2);
      expect(userRes.isAdmin).toBe(false);
      expect(userRes.isActive).toBe(true); // Assuming default

      // Verify no old API key or usage fields are present
      expect(userRes.apiKey).toBeUndefined();
      expect(userRes.maxRps).toBeUndefined();
      expect(userRes.requests).toBeUndefined();
      expect(userRes.dailyRequests).toBeUndefined();
      expect(userRes.lastResetDate).toBeUndefined();
      
      // Verify endpoints are removed
      expect(res.body.data.endpoints).toBeUndefined();
    });
  });

  describe('Removed/Deprecated Routes', () => {
    let userToken: string;
     beforeEach(async () => {
      await createUser({ email: 'depuser@example.com', password: 'password123' });
      userToken = await loginUser(request, 'depuser@example.com', 'password123');
    });

    it('POST /auth/regenerate-api-key should return 404', async () => {
      const res = await request.post('/auth/regenerate-api-key').set('Authorization', `Bearer ${userToken}`);
      // This route is not part of auth.routes.ts anymore, so it should hit the global 404 handler in app.ts
      expect(res.status).toBe(404); 
      expect(res.body.message).toContain('The method POST is not defined on path /auth/regenerate-api-key');
    });

    it('GET /auth/usage should reflect deprecated user-level stats', async () => {
      const res = await request.get('/auth/usage').set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('User-level usage statistics are deprecated. Please check usage per application.');
      
      const userRes = res.body.data.user;
      expect(userRes.id).toBeDefined();
      expect(userRes.email).toBe('depuser@example.com');
      expect(userRes.appCount).toBeDefined(); // Should be 0 for a new user
      expect(userRes.isAdmin).toBeDefined();

      // Verify no old usage fields are present
      expect(res.body.data.totalRequests).toBeUndefined();
      expect(res.body.data.dailyRequests).toBeUndefined();
      expect(res.body.data.dailyLimit).toBeUndefined();
      expect(res.body.data.rateLimitRps).toBeUndefined();
    });
  });
});
