import { Request, Response, NextFunction } from 'express';
import { adminAuth } from './admin.middleware';
import User from '../models/user.model';

// Mock the User model
jest.mock('../models/user.model');

interface MockRequest extends Partial<Request> {
  userId?: string; // For AuthenticatedRequest
}

describe('Admin Auth Middleware', () => {
  let mockRequest: MockRequest;
  let mockResponse: Partial<Response>;
  let mockNextFunction: NextFunction;
  let responseJson: any;
  let responseStatus: number;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {};
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
  });

  it('should grant access if user is an admin', async () => {
    mockRequest.userId = 'adminUserId';
    (User.findById as jest.Mock).mockResolvedValue({ _id: 'adminUserId', isAdmin: true });

    await adminAuth(mockRequest as Request, mockResponse as Response, mockNextFunction);

    expect(User.findById).toHaveBeenCalledWith('adminUserId');
    expect(mockNextFunction).toHaveBeenCalledTimes(1);
    expect(responseStatus).toBe(0); // No status set means next() was called
  });

  it('should deny access with 403 if user is not an admin', async () => {
    mockRequest.userId = 'nonAdminUserId';
    (User.findById as jest.Mock).mockResolvedValue({ _id: 'nonAdminUserId', isAdmin: false });

    await adminAuth(mockRequest as Request, mockResponse as Response, mockNextFunction);

    expect(User.findById).toHaveBeenCalledWith('nonAdminUserId');
    expect(mockNextFunction).not.toHaveBeenCalled();
    expect(responseStatus).toBe(403);
    expect(responseJson.message).toBe('Forbidden: User is not an administrator');
  });

  it('should return 401 if userId is not found in request', async () => {
    mockRequest.userId = undefined; // Simulate userId not being set by previous auth middleware

    await adminAuth(mockRequest as Request, mockResponse as Response, mockNextFunction);

    expect(User.findById).not.toHaveBeenCalled();
    expect(mockNextFunction).not.toHaveBeenCalled();
    expect(responseStatus).toBe(401);
    expect(responseJson.message).toBe('Unauthorized: User ID not found in request');
  });

  it('should return 404 if user is not found in database', async () => {
    mockRequest.userId = 'ghostUserId';
    (User.findById as jest.Mock).mockResolvedValue(null); // Simulate user not found

    await adminAuth(mockRequest as Request, mockResponse as Response, mockNextFunction);

    expect(User.findById).toHaveBeenCalledWith('ghostUserId');
    expect(mockNextFunction).not.toHaveBeenCalled();
    expect(responseStatus).toBe(404);
    expect(responseJson.message).toBe('User not found');
  });

  it('should return 500 if there is a database error', async () => {
    mockRequest.userId = 'errorUserId';
    (User.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

    await adminAuth(mockRequest as Request, mockResponse as Response, mockNextFunction);

    expect(User.findById).toHaveBeenCalledWith('errorUserId');
    expect(mockNextFunction).not.toHaveBeenCalled();
    expect(responseStatus).toBe(500);
    expect(responseJson.message).toBe('Internal server error');
  });
});
