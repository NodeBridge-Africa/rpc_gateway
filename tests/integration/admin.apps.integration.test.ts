import supertest from 'supertest';
import { createTestApp, TestAppContainer } from '../helpers/testApp'; // Assuming TestAppContainer is the type
import App from '../../src/models/app.model';
import User from '../../src/models/user.model'; // Needed to create a user for the app
import { Types } from 'mongoose';

describe('PATCH /admin/apps/:appId', () => {
  let appContainer: TestAppContainer;
  let request: supertest.SuperTest<supertest.Test>;
  let adminToken: string;
  let regularUserToken: string; // For forbidden tests
  let testApp: any;
  let testUser: any;

  beforeAll(async () => {
    appContainer = createTestApp();
    request = supertest(appContainer.app);
    // Assuming getAdminToken and getRegularUserToken are available and create/return users
    adminToken = await appContainer.getAdminToken(); 
    regularUserToken = await appContainer.getRegularUserToken(); 
  });

  beforeEach(async () => {
    // Clean up and seed database before each test
    await App.deleteMany({});
    await User.deleteMany({ email: { $ne: appContainer.adminUser?.email } }); // Keep admin user

    // Create a user for the app
    testUser = await User.create({
        email: 'appowner@example.com',
        password: 'Password123!',
        apiKey: new Types.ObjectId().toString(), // Mock API Key
        isActive: true,
    });

    testApp = await App.create({
      name: 'Original Test App',
      description: 'Original Description',
      userId: testUser._id,
      chainName: 'Sepolia',
      chainId: '11155111',
      maxRps: 10,
      dailyRequestsLimit: 1000,
      isActive: true,
    });
  });

  afterAll(async () => {
    await appContainer.cleanup();
  });

  test('Test 1: Unauthorized (no token)', async () => {
    const response = await request
      .patch(`/admin/apps/${testApp._id}`)
      .send({ name: 'Updated Name' });
    expect(response.status).toBe(401); // Or 403 depending on auth middleware
  });

  test('Test 2: Forbidden (non-admin token)', async () => {
    const response = await request
      .patch(`/admin/apps/${testApp._id}`)
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ name: 'Updated Name' });
    expect(response.status).toBe(403);
  });

  test('Test 3: Invalid App ID in path', async () => {
    const response = await request
      .patch('/admin/apps/invalid-app-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Name' });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].msg).toBe('Invalid App ID format');
  });

  test('Test 4: Empty request body', async () => {
    const response = await request
      .patch(`/admin/apps/${testApp._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(response.status).toBe(400);
    // Based on express-validator custom rule
    expect(response.body.errors[0].msg).toContain('Request body cannot be empty');
  });

  test('Test 5: Invalid field in body (e.g., maxRps as string)', async () => {
    const response = await request
      .patch(`/admin/apps/${testApp._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ maxRps: 'not-a-number' });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].path).toBe('maxRps');
    expect(response.body.errors[0].msg).toBe('maxRps must be a non-negative integer');
  });
  
  test('Test 5b: Invalid apiKey format (not UUID)', async () => {
    const response = await request
      .patch(`/admin/apps/${testApp._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ apiKey: 'not-a-uuid' });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].path).toBe('apiKey');
    expect(response.body.errors[0].msg).toBe('apiKey must be a valid UUID v4');
  });


  test('Test 6: App not found', async () => {
    const nonExistentAppId = new Types.ObjectId().toString();
    const response = await request
      .patch(`/admin/apps/${nonExistentAppId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Name' });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(`App with ID '${nonExistentAppId}' not found.`);
  });

  test('Test 7: Successful app update (multiple fields)', async () => {
    const newUserId = new Types.ObjectId().toString(); // Simulate a different user
    const updateData = {
      name: 'Updated App Name',
      description: 'Updated Description',
      isActive: false,
      maxRps: 20,
      userId: newUserId, // Ensure this user exists or test will fail on FK if enforced
    };
    
    // Create the new user if needed for this test to pass FK constraints if they exist at DB level
    // For this test, we assume it's just an ID field and no strict FK check at DB level for App model
    // or that the controller doesn't check User existence for userId field.

    const response = await request
      .patch(`/admin/apps/${testApp._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.app.name).toBe(updateData.name);
    expect(response.body.data.app.description).toBe(updateData.description);
    expect(response.body.data.app.isActive).toBe(updateData.isActive);
    expect(response.body.data.app.maxRps).toBe(updateData.maxRps);
    expect(response.body.data.app.userId.toString()).toBe(newUserId); // userId should be updated

    const dbApp = await App.findById(testApp._id);
    expect(dbApp?.name).toBe(updateData.name);
    expect(dbApp?.description).toBe(updateData.description);
    expect(dbApp?.isActive).toBe(updateData.isActive);
    expect(dbApp?.maxRps).toBe(updateData.maxRps);
    expect(dbApp?.userId.toString()).toBe(newUserId);
  });
  
  test('Test 8: Attempt to update with only an empty string apiKey (should be ignored by controller)', async () => {
    const response = await request
      .patch(`/admin/apps/${testApp._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ apiKey: "", name: "Name Change With Empty APIKey" }); // Controller should filter out empty apiKey

    expect(response.status).toBe(200);
    expect(response.body.data.app.name).toBe("Name Change With Empty APIKey");
    expect(response.body.data.app.apiKey).not.toBe(""); // Original API key should remain
    expect(response.body.data.app.apiKey).toBe(testApp.apiKey); // Assuming original app has an apiKey

    const dbApp = await App.findById(testApp._id);
    expect(dbApp?.name).toBe("Name Change With Empty APIKey");
    expect(dbApp?.apiKey).toBe(testApp.apiKey); 
  });
});
