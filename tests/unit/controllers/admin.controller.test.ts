import { Request, Response } from 'express';
import { AdminController } from '../../../src/controllers/admin.controller';
import App from '../../../src/models/app.model';
import User from '../../../src/models/user.model';
import { successResponse, errorResponse } from '../../../src/utils/responseHandler';

// Mock the models
jest.mock('../../../src/models/app.model');
jest.mock('../../../src/models/user.model');

// Mock the response handlers
jest.mock('../../../src/utils/responseHandler', () => ({
  successResponse: jest.fn(),
  errorResponse: jest.fn(),
}));

describe('AdminController - Unit Tests', () => {
  let adminController: AdminController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    adminController = new AdminController();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRequest = {
      params: {},
      body: {},
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('AdminController - updateAppDetails', () => {
    const mockAppId = '605c72ef1e18982d047a9f66';
    const mockAppData = { name: 'Test App', description: 'Test Description' };

    test('Test 1: Successful app update', async () => {
      const updatedApp = { _id: mockAppId, ...mockAppData, chainName: 'Sepolia' };
      (App.findByIdAndUpdate as jest.Mock).mockResolvedValue(updatedApp);

      mockRequest.params = { appId: mockAppId };
      mockRequest.body = mockAppData;

      await adminController.updateAppDetails(mockRequest as Request, mockResponse as Response);

      expect(App.findByIdAndUpdate).toHaveBeenCalledWith(
        mockAppId,
        { $set: mockAppData },
        { new: true, runValidators: true }
      );
      expect(successResponse).toHaveBeenCalledWith(mockResponse, 200, 'App details updated successfully.', { app: updatedApp });
    });

    test('Test 2: App not found (404)', async () => {
      (App.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      mockRequest.params = { appId: mockAppId };
      mockRequest.body = mockAppData;

      await adminController.updateAppDetails(mockRequest as Request, mockResponse as Response);

      expect(errorResponse).toHaveBeenCalledWith(mockResponse, 404, `App with ID '${mockAppId}' not found.`);
    });
    
    test('Test 3: Invalid App ID format (CastError)', async () => {
        (App.findByIdAndUpdate as jest.Mock).mockRejectedValue({ name: 'CastError', path: '_id' });
        mockRequest.params = { appId: 'invalid-id' };
        mockRequest.body = mockAppData;

        await adminController.updateAppDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 400, 'Invalid App ID format.');
    });

    test('Test 4: Mongoose Validation Error', async () => {
        const validationError = { name: 'ValidationError', message: 'App validation failed' };
        (App.findByIdAndUpdate as jest.Mock).mockRejectedValue(validationError);
        mockRequest.params = { appId: mockAppId };
        mockRequest.body = { name: '' }; // Invalid data to trigger validation error

        await adminController.updateAppDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 400, 'Validation error.', { details: validationError.message });
    });
    
    test('Test 5: Empty request body (controller level)', async () => {
        mockRequest.params = { appId: mockAppId };
        mockRequest.body = {}; // Empty body

        await adminController.updateAppDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 400, 'No valid fields provided for update.');
    });
    
    test('Test 6: apiKey is empty string (should be ignored)', async () => {
        const updatedApp = { _id: mockAppId, name: 'App Name' };
        (App.findByIdAndUpdate as jest.Mock).mockResolvedValue(updatedApp);

        mockRequest.params = { appId: mockAppId };
        mockRequest.body = { name: 'App Name', apiKey: '' };

        await adminController.updateAppDetails(mockRequest as Request, mockResponse as Response);
        
        // Check that findByIdAndUpdate was called without apiKey
        expect(App.findByIdAndUpdate).toHaveBeenCalledWith(
            mockAppId,
            { $set: { name: 'App Name' } }, // apiKey should be filtered out
            { new: true, runValidators: true }
        );
        expect(successResponse).toHaveBeenCalledWith(mockResponse, 200, 'App details updated successfully.', { app: updatedApp });
    });
  });

  describe('AdminController - updateUserDetails', () => {
    const mockUserId = '605c72ef1e18982d047a9f77';
    const mockUserUpdateData = { email: 'new.email@example.com', isActive: false };
    const mockUserInstance = {
        _id: mockUserId,
        email: 'old.email@example.com',
        isActive: true,
        password: 'hashedPassword',
        save: jest.fn(),
        toObject: jest.fn(),
    };

    beforeEach(() => {
        // Reset mocks for User model instance methods
        mockUserInstance.save.mockReset();
        mockUserInstance.toObject.mockReset();
        // Default toObject to return a plain object without password
        mockUserInstance.toObject.mockImplementation(() => {
            const obj = { ...mockUserInstance };
            delete obj.password;
            delete obj.save; // remove methods from the plain object
            delete obj.toObject;
            return obj;
        });
    });

    test('Test 1: Successful user update (no password change)', async () => {
      const updatedUser = { _id: mockUserId, ...mockUserUpdateData };
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({ ...updatedUser, toObject: () => updatedUser });


      mockRequest.params = { userId: mockUserId };
      mockRequest.body = mockUserUpdateData;

      await adminController.updateUserDetails(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        { $set: mockUserUpdateData },
        { new: true, runValidators: true }
      );
      expect(successResponse).toHaveBeenCalledWith(mockResponse, 200, 'User details updated successfully.', { user: updatedUser });
    });

    test('Test 2: Successful user update (with password change)', async () => {
      const newPassword = 'newSecurePassword123';
      mockRequest.params = { userId: mockUserId };
      mockRequest.body = { password: newPassword, email: 'updated.email@example.com' };
      
      (User.findById as jest.Mock).mockResolvedValue(mockUserInstance);
      mockUserInstance.save.mockResolvedValue({ 
          ...mockUserInstance, 
          email: 'updated.email@example.com', 
          password: 'newHashedPassword' // Simulate password got hashed
      });

      await adminController.updateUserDetails(mockRequest as Request, mockResponse as Response);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockUserInstance.email).toBe('updated.email@example.com');
      expect(mockUserInstance.password).toBe(newPassword); // Before save, it's the plain text
      expect(mockUserInstance.save).toHaveBeenCalled();
      expect(successResponse).toHaveBeenCalledWith(mockResponse, 200, 'User details updated successfully.', { 
          user: expect.objectContaining({ email: 'updated.email@example.com' })
      });
    });

    test('Test 3: User not found (404) - no password', async () => {
        (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
        mockRequest.params = { userId: mockUserId };
        mockRequest.body = { isActive: false };

        await adminController.updateUserDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 404, `User with ID '${mockUserId}' not found.`);
    });

    test('Test 4: User not found (404) - with password', async () => {
        (User.findById as jest.Mock).mockResolvedValue(null);
        mockRequest.params = { userId: mockUserId };
        mockRequest.body = { password: 'newPassword123' };

        await adminController.updateUserDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 404, `User with ID '${mockUserId}' not found.`);
    });

    test('Test 5: Password is empty string', async () => {
        mockRequest.params = { userId: mockUserId };
        mockRequest.body = { password: "" };

        await adminController.updateUserDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 400, 'Password cannot be an empty string.');
    });

    test('Test 6: Mongoose Validation Error on save (e.g., duplicate email)', async () => {
        const mongoError = { name: 'MongoError', code: 11000, message: 'Duplicate key' };
        (User.findById as jest.Mock).mockResolvedValue(mockUserInstance);
        mockUserInstance.save.mockRejectedValue(mongoError);
        
        mockRequest.params = { userId: mockUserId };
        mockRequest.body = { email: 'duplicate@example.com', password: 'newPassword123' };

        await adminController.updateUserDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 409, 'Email address is already in use by another account.');
    });
    
    test('Test 7: Mongoose general Validation Error on save', async () => {
        const validationError = { name: 'ValidationError', message: 'User validation failed' };
        (User.findById as jest.Mock).mockResolvedValue(mockUserInstance);
        mockUserInstance.save.mockRejectedValue(validationError);
        
        mockRequest.params = { userId: mockUserId };
        // e.g. email is invalid, which might be caught by schema validation before save
        // but this test is for errors during .save()
        mockRequest.body = { email: 'invalid-email-format', password: 'newPassword123' }; 

        await adminController.updateUserDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 400, 'Validation error.', { details: validationError.message });
    });
    
    test('Test 8: Empty request body (controller level)', async () => {
        mockRequest.params = { userId: mockUserId };
        mockRequest.body = {}; // Empty body

        await adminController.updateUserDetails(mockRequest as Request, mockResponse as Response);
        expect(errorResponse).toHaveBeenCalledWith(mockResponse, 400, 'No valid fields provided for update.');
    });
  });
});
