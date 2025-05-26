import { Request, Response, NextFunction } from 'express';
import { apiKeyGuard, ApiKeyRequest, extractApiKey } from './apiKey.middleware';
import App from '../models/app.model';

// Mock the App model
jest.mock('../models/app.model');

describe('API Key Middleware', () => {
  let mockRequest: Partial<ApiKeyRequest>;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      // Simulating Express :key param behavior
      // In a real Express app, req.params would be set by the router
      // For this test, we'll set it directly if the test needs it.
      params: {},
    };
    responseJson = {};
    responseStatus = 0;
    mockNextFunction = jest.fn();
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

    // Mock environment variable
    process.env.DEFAULT_DAILY_REQUESTS = '10000';
  });

  describe('apiKeyGuard', () => {
    it('should grant access and set req.app if API key is valid and active', async () => {
      const mockApiKey = 'valid-key';
      mockRequest.params = { key: mockApiKey };
      const mockAppInstance = {
        _id: 'appId',
        apiKey: mockApiKey,
        isActive: true,
        dailyRequests: 0,
        requests: 0,
        maxRps: 20,
        resetDailyRequestsIfNeeded: jest.fn().mockResolvedValue(undefined),
        // Add other IApp properties as needed by the middleware
      };
      (App.findOneAndUpdate as jest.Mock).mockResolvedValue(mockAppInstance);

      await apiKeyGuard(mockRequest as ApiKeyRequest, mockResponse as Response, mockNextFunction);

      expect(App.findOneAndUpdate).toHaveBeenCalledWith(
        { apiKey: mockApiKey, isActive: true },
        { $inc: { requests: 1, dailyRequests: 1 } },
        { new: true }
      );
      expect(mockAppInstance.resetDailyRequestsIfNeeded).toHaveBeenCalledTimes(1);
      expect(mockRequest.app).toBe(mockAppInstance);
      expect(mockRequest.apiKey).toBe(mockApiKey);
      expect(mockNextFunction).toHaveBeenCalledTimes(1);
      expect(responseStatus).toBe(0);
    });

    it('should return 400 if API key is missing from URL params', async () => {
      mockRequest.params = {}; // No key
      await apiKeyGuard(mockRequest as ApiKeyRequest, mockResponse as Response, mockNextFunction);

      expect(responseStatus).toBe(400);
      expect(responseJson.error).toBe('Missing API key in URL path');
      expect(mockNextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if API key is invalid or app is inactive', async () => {
      mockRequest.params = { key: 'invalid-key' };
      (App.findOneAndUpdate as jest.Mock).mockResolvedValue(null); // Simulate app not found

      await apiKeyGuard(mockRequest as ApiKeyRequest, mockResponse as Response, mockNextFunction);

      expect(responseStatus).toBe(403);
      expect(responseJson.error).toBe('Invalid or inactive API key');
      expect(mockNextFunction).not.toHaveBeenCalled();
    });

    it('should return 429 if daily request limit is exceeded', async () => {
      const mockApiKey = 'limit-exceeded-key';
      mockRequest.params = { key: mockApiKey };
      const dailyLimit = parseInt(process.env.DEFAULT_DAILY_REQUESTS || "10000");
      const mockAppInstance = {
        _id: 'appId',
        apiKey: mockApiKey,
        isActive: true,
        dailyRequests: dailyLimit + 1, // Exceeds limit
        requests: 50000,
        maxRps: 20,
        resetDailyRequestsIfNeeded: jest.fn().mockResolvedValue(undefined),
      };
      (App.findOneAndUpdate as jest.Mock).mockResolvedValue(mockAppInstance);

      await apiKeyGuard(mockRequest as ApiKeyRequest, mockResponse as Response, mockNextFunction);
      
      expect(mockAppInstance.resetDailyRequestsIfNeeded).toHaveBeenCalledTimes(1); // Still called
      expect(responseStatus).toBe(429);
      expect(responseJson.error).toBe('Daily request limit exceeded');
      expect(mockNextFunction).not.toHaveBeenCalled();
    });
    
    it('should return 500 if there is a database error', async () => {
      mockRequest.params = { key: 'error-key' };
      (App.findOneAndUpdate as jest.Mock).mockRejectedValue(new Error('Database error'));

      await apiKeyGuard(mockRequest as ApiKeyRequest, mockResponse as Response, mockNextFunction);

      expect(responseStatus).toBe(500);
      expect(responseJson.error).toBe('Internal server error');
      expect(mockNextFunction).not.toHaveBeenCalled();
    });
  });

  describe('extractApiKey', () => {
    it('should extract API key correctly from /exec/:key/path', () => {
      mockRequest.path = '/exec/test-api-key/some/other/path';
      expect(extractApiKey(mockRequest as Request)).toBe('test-api-key');
    });

    it('should extract API key correctly from /cons/:key/path', () => {
      mockRequest.path = '/cons/another-key/endpoint';
      expect(extractApiKey(mockRequest as Request)).toBe('another-key');
    });

    it('should return null if path format is incorrect or key is missing', () => {
      mockRequest.path = '/exec/'; // Missing key
      expect(extractApiKey(mockRequest as Request)).toBeNull();

      mockRequest.path = '/other/path/structure';
      expect(extractApiKey(mockRequest as Request)).toBeNull();
       mockRequest.path = '/exec//somepath'; // Empty key
      expect(extractApiKey(mockRequest as Request)).toBeNull();
    });
  });
});
