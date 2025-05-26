import { Request, Response } from 'express';
import { createApp, listApps } from './app.controller';
import App from '../models/app.model';
import User from '../models/user.model';
import Chain from '../models/chain.model';
import { DEFAULT_APP_MAX_RPS } from '../config/constants';
import { v4 as uuidv4 } from 'uuid';

// Mock the models
jest.mock('../models/app.model');
jest.mock('../models/user.model');
jest.mock('../models/chain.model');
jest.mock('uuid', () => ({ v4: jest.fn() }));


// Define a type for our mock request
interface MockRequest extends Partial<Request> {
  userId?: string; // For AuthenticatedRequest
  body?: any;
}

describe('App Controller', () => {
  let mockRequest: MockRequest;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();

    (uuidv4 as jest.Mock).mockReturnValue('mock-api-key');


    mockRequest = {
      body: {},
    };
    responseJson = {};
    responseStatus = 0;
    mockResponse = {
      status: jest.fn().mockImplementation((status) => {
        responseStatus = status;
        return {
          json: jest.fn().mockImplementation((json) => {
            responseJson = json;
          }),
        };
      }),
      json: jest.fn().mockImplementation((json) => {
        responseJson = json;
      }),
    };
  });

  describe('createApp', () => {
    beforeEach(() => {
      mockRequest.userId = 'testUserId';
      mockRequest.body = {
        name: 'Test App',
        description: 'A test application',
        chainName: 'TestChain',
        chainId: '123',
      };
    });

    it('should create an app successfully', async () => {
      const mockUser = { _id: 'testUserId', appCount: 0, save: jest.fn().mockResolvedValue(true) };
      const mockChain = { _id: 'testChainId', chainName: 'TestChain', chainId: '123', isEnabled: true };
      const mockSavedApp = {
        ...mockRequest.body,
        userId: 'testUserId',
        apiKey: 'mock-api-key',
        maxRps: DEFAULT_APP_MAX_RPS,
        requests: 0,
        dailyRequests: 0,
        isActive: true,
        lastResetDate: new Date(),
        _id: 'mockAppId'
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Chain.findOne as jest.Mock).mockResolvedValue(mockChain);
      (App.prototype.save as jest.Mock).mockResolvedValue(mockSavedApp);


      await createApp(mockRequest as Request, mockResponse as Response);

      expect(User.findById).toHaveBeenCalledWith('testUserId');
      expect(Chain.findOne).toHaveBeenCalledWith({ chainName: 'TestChain', chainId: '123', isEnabled: true });
      expect(App.prototype.save).toHaveBeenCalledTimes(1);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(mockUser.appCount).toBe(1);
      expect(responseStatus).toBe(201);
      expect(responseJson).toEqual(mockSavedApp);
    });

    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = { name: 'Test App' }; // Missing chainName and chainId
      await createApp(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(400);
      expect(responseJson.message).toBe('Missing required fields: name, chainName, chainId');
    });

    it('should return 401 if userId is not found in request', async () => {
      mockRequest.userId = undefined;
      await createApp(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(401);
      expect(responseJson.message).toBe('Unauthorized: User ID not found in request');
    });

    it('should return 404 if user is not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);
      await createApp(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(404);
      expect(responseJson.message).toBe('User not found');
    });

    it('should return 403 if app limit is reached', async () => {
      const mockUser = { _id: 'testUserId', appCount: 5, save: jest.fn() };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      await createApp(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(403);
      expect(responseJson.message).toBe('App limit reached. Maximum 5 apps allowed.');
    });

    it('should return 400 if chain is invalid or disabled', async () => {
      const mockUser = { _id: 'testUserId', appCount: 0, save: jest.fn() };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (Chain.findOne as jest.Mock).mockResolvedValue(null); // Simulate chain not found or disabled
      await createApp(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(400);
      expect(responseJson.message).toBe('Invalid or disabled chain');
    });
     it('should return 500 if there is an error during app creation', async () => {
      (User.findById as jest.Mock).mockRejectedValue(new Error('Database error'));
      await createApp(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(500);
      expect(responseJson.message).toBe('Internal server error while creating app');
    });
  });

  describe('listApps', () => {
    beforeEach(() => {
      mockRequest.userId = 'testUserId';
    });

    it('should list apps successfully for a user', async () => {
      const mockApps = [{ name: 'App1' }, { name: 'App2' }];
      (App.find as jest.Mock).mockResolvedValue(mockApps);

      await listApps(mockRequest as Request, mockResponse as Response);

      expect(App.find).toHaveBeenCalledWith({ userId: 'testUserId' });
      expect(responseStatus).toBe(200);
      expect(responseJson).toEqual(mockApps);
    });

    it('should return an empty array if user has no apps', async () => {
      (App.find as jest.Mock).mockResolvedValue([]);
      await listApps(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(200);
      expect(responseJson).toEqual([]);
    });

    it('should return 401 if userId is not found in request', async () => {
      mockRequest.userId = undefined;
      await listApps(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(401);
      expect(responseJson.message).toBe('Unauthorized: User ID not found in request');
    });

    it('should return 500 if there is an error during listing apps', async () => {
      (App.find as jest.Mock).mockRejectedValue(new Error('Database error'));
      await listApps(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(500);
      expect(responseJson.message).toBe('Internal server error while listing apps');
    });
  });
});
