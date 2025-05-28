import supertest from 'supertest';
import { createTestApp, TestAppContainer } from '../helpers/testApp';
import User from '../../src/models/user.model';
import { Types } from 'mongoose';

describe('PATCH /admin/users/:userId', () => {
  let appContainer: TestAppContainer;
  let request: supertest.SuperTest<supertest.Test>;
  let adminToken: string;
  let regularUserToken: string;
  let testUser: any;
  let otherUser: any; // For email conflict test

  beforeAll(async () => {
    appContainer = createTestApp();
    request = supertest(appContainer.app);
    adminToken = await appContainer.getAdminToken();
    regularUserToken = await appContainer.getRegularUserToken(); // Used for forbidden test
  });

  beforeEach(async () => {
    await User.deleteMany({ email: { $nin: [appContainer.adminUser?.email, appContainer.regularUser?.email] } });
    
    testUser = await User.create({
      email: 'testuser.to.update@example.com',
      password: 'Password123!',
      apiKey: new Types.ObjectId().toString(),
      isActive: true,
    });

    otherUser = await User.create({
      email: 'otheruser@example.com',
      password: 'Password456!',
      apiKey: new Types.ObjectId().toString(),
      isActive: true,
    });
  });

  afterAll(async () => {
    await appContainer.cleanup();
  });

  test('Test 1: Unauthorized (no token)', async () => {
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .send({ isActive: false });
    expect(response.status).toBe(401); // Or 403
  });

  test('Test 1b: Forbidden (non-admin token)', async () => {
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ isActive: false });
    expect(response.status).toBe(403);
  });

  test('Test 2: Invalid User ID in path', async () => {
    const response = await request
      .patch('/admin/users/invalid-user-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].msg).toBe('Invalid User ID format');
  });

  test('Test 3: Empty request body', async () => {
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.errors[0].msg).toContain('Request body cannot be empty');
  });

  test('Test 4: Invalid field in body (e.g., bad email)', async () => {
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].path).toBe('email');
    expect(response.body.errors[0].msg).toBe('Invalid email format');
  });
  
  test('Test 4b: Invalid password (too short)', async () => {
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].path).toBe('password');
    expect(response.body.errors[0].msg).toBe('Password must be between 8 and 128 characters');
  });


  test('Test 5: User not found', async () => {
    const nonExistentUserId = new Types.ObjectId().toString();
    const response = await request
      .patch(`/admin/users/${nonExistentUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(`User with ID '${nonExistentUserId}' not found.`);
  });

  test('Test 6: Successful user update (no password)', async () => {
    const updateData = {
      email: 'updated.email@example.com',
      isActive: false,
    };
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(updateData.email);
    expect(response.body.data.user.isActive).toBe(updateData.isActive);
    expect(response.body.data.user.password).toBeUndefined(); // Password should not be returned

    const dbUser = await User.findById(testUser._id);
    expect(dbUser?.email).toBe(updateData.email);
    expect(dbUser?.isActive).toBe(updateData.isActive);
  });

  test('Test 7: Successful user update (with password)', async () => {
    const newPassword = 'newSecurePassword123';
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: newPassword, isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.isActive).toBe(false);
    expect(response.body.data.user.password).toBeUndefined();

    const dbUser = await User.findById(testUser._id);
    expect(dbUser?.isActive).toBe(false);
    // Verify password was changed by checking it's different from the original
    // Direct comparison of hashed password is tricky, but user.comparePassword should work
    const isMatch = await dbUser?.comparePassword(newPassword);
    expect(isMatch).toBe(true);
    
    const isOldPasswordMatch = await dbUser?.comparePassword('Password123!');
    expect(isOldPasswordMatch).toBe(false);
  });

  test('Test 8: Email already exists', async () => {
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: otherUser.email }); // Attempt to set testUser's email to otherUser's email

    expect(response.status).toBe(409); // Or 400 depending on how controller handles MongoError 11000
    expect(response.body.message).toBe('Email address is already in use by another account.');
  });
  
  test('Test 9: Update only isActive status', async () => {
    const response = await request
      .patch(`/admin/users/${testUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.user.isActive).toBe(false);
    expect(response.body.data.user.email).toBe(testUser.email); // Email should be unchanged

    const dbUser = await User.findById(testUser._id);
    expect(dbUser?.isActive).toBe(false);
    expect(dbUser?.email).toBe(testUser.email);
  });
});
