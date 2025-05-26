import { Request, Response } from 'express';
import { addChain, listChains, updateChain, deleteChain } from './chain.controller';
import Chain from '../models/chain.model';

// Mock the Chain model
jest.mock('../models/chain.model');

describe('Chain Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: any;
  let responseStatus: number;
  let responseSend: boolean;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      body: {},
      params: {},
    };
    responseJson = {};
    responseStatus = 0;
    responseSend = false; // For 204 No Content

    mockResponse = {
      status: jest.fn().mockImplementation((status) => {
        responseStatus = status;
        return {
          json: jest.fn().mockImplementation((json) => {
            responseJson = json;
          }),
          send: jest.fn().mockImplementation(() => {
            responseSend = true;
          }),
        };
      }),
      json: jest.fn().mockImplementation((json) => {
        responseJson = json;
      }),
    };
  });

  describe('addChain', () => {
    it('should add a chain successfully', async () => {
      mockRequest.body = { chainName: 'NewChain', chainId: '1', description: 'A new chain' };
      const mockSavedChain = { ...mockRequest.body, _id: 'someId', isEnabled: true };
      (Chain.findOne as jest.Mock).mockResolvedValue(null);
      (Chain.prototype.save as jest.Mock).mockResolvedValue(mockSavedChain);

      await addChain(mockRequest as Request, mockResponse as Response);

      expect(Chain.findOne).toHaveBeenCalledWith({ $or: [{ chainName: 'NewChain' }, { chainId: '1' }] });
      expect(Chain.prototype.save).toHaveBeenCalledTimes(1);
      expect(responseStatus).toBe(201);
      expect(responseJson).toEqual(mockSavedChain);
    });

    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = { description: 'Only description' };
      await addChain(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(400);
      expect(responseJson.message).toBe('Missing required fields: chainName, chainId');
    });

    it('should return 409 if chain name or chainId already exists', async () => {
      mockRequest.body = { chainName: 'ExistingChain', chainId: '2' };
      (Chain.findOne as jest.Mock).mockResolvedValue({ _id: 'existingId' }); // Simulate chain exists

      await addChain(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(409);
      expect(responseJson.message).toBe('Chain name or chainId already exists');
    });
     it('should return 500 on server error', async () => {
      mockRequest.body = { chainName: 'ErrorChain', chainId: '3' };
      (Chain.findOne as jest.Mock).mockRejectedValue(new Error('DB error'));
      await addChain(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(500);
      expect(responseJson.message).toBe('Internal server error while adding chain');
    });
  });

  describe('listChains', () => {
    it('should list all chains successfully', async () => {
      const mockChains = [{ name: 'Chain1' }, { name: 'Chain2' }];
      (Chain.find as jest.Mock).mockResolvedValue(mockChains);

      await listChains(mockRequest as Request, mockResponse as Response);

      expect(Chain.find).toHaveBeenCalledTimes(1);
      expect(responseStatus).toBe(200);
      expect(responseJson).toEqual(mockChains);
    });
     it('should return 500 on server error', async () => {
      (Chain.find as jest.Mock).mockRejectedValue(new Error('DB error'));
      await listChains(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(500);
      expect(responseJson.message).toBe('Internal server error while listing chains');
    });
  });

  describe('updateChain', () => {
    const chainIdToUpdate = 'existingChainId';
    let mockExistingChain: any;

    beforeEach(() => {
        mockRequest.params = { chainId: chainIdToUpdate };
        mockExistingChain = {
            _id: 'someMongoId',
            chainId: chainIdToUpdate,
            chainName: 'OriginalName',
            description: 'Original Description',
            isEnabled: true,
            save: jest.fn().mockImplementation(function(this: any) { // Use function to access this
                return Promise.resolve(this);
            })
        };
        (Chain.findOne as jest.Mock).mockImplementation(({ chainId }) => {
            if (chainId === chainIdToUpdate) {
                return Promise.resolve(mockExistingChain);
            }
            return Promise.resolve(null); // For uniqueness checks
        });
    });

    it('should update a chain successfully', async () => {
        mockRequest.body = { chainName: 'UpdatedName', description: 'Updated Description', isEnabled: false };
        await updateChain(mockRequest as Request, mockResponse as Response);

        expect(Chain.findOne).toHaveBeenCalledWith({ chainId: chainIdToUpdate });
        expect(mockExistingChain.save).toHaveBeenCalledTimes(1);
        expect(mockExistingChain.chainName).toBe('UpdatedName');
        expect(mockExistingChain.description).toBe('Updated Description');
        expect(mockExistingChain.isEnabled).toBe(false);
        expect(responseStatus).toBe(200);
        expect(responseJson.chainName).toBe('UpdatedName');
    });

    it('should return 404 if chain to update is not found', async () => {
        (Chain.findOne as jest.Mock).mockResolvedValueOnce(null); // First call for finding the chain
        mockRequest.params = { chainId: 'nonExistentId' };
        await updateChain(mockRequest as Request, mockResponse as Response);
        expect(responseStatus).toBe(404);
        expect(responseJson.message).toBe('Chain not found');
    });

    it('should return 409 if new chainName already exists', async () => {
        mockRequest.body = { chainName: 'TakenName' };
        // First findOne is for the chain being updated
        (Chain.findOne as jest.Mock).mockResolvedValueOnce(mockExistingChain);
        // Second findOne is for the uniqueness check of the new name
        (Chain.findOne as jest.Mock).mockResolvedValueOnce({ _id: 'otherId', chainName: 'TakenName' });

        await updateChain(mockRequest as Request, mockResponse as Response);
        expect(responseStatus).toBe(409);
        expect(responseJson.message).toBe('New chainName already exists');
    });

    it('should return 409 if new chainId already exists', async () => {
        mockRequest.body = { chainId: 'TakenChainId' };
         // First findOne is for the chain being updated
        (Chain.findOne as jest.Mock).mockResolvedValueOnce(mockExistingChain);
        // Second findOne is for the uniqueness check of the new chainId
        (Chain.findOne as jest.Mock).mockResolvedValueOnce({ _id: 'otherId', chainId: 'TakenChainId' });

        await updateChain(mockRequest as Request, mockResponse as Response);
        expect(responseStatus).toBe(409);
        expect(responseJson.message).toBe('New chainId already exists');
    });
    
    it('should only update provided fields', async () => {
        mockRequest.body = { description: 'Only Description Updated' };
        await updateChain(mockRequest as Request, mockResponse as Response);
        expect(mockExistingChain.description).toBe('Only Description Updated');
        expect(mockExistingChain.chainName).toBe('OriginalName'); // Unchanged
        expect(mockExistingChain.isEnabled).toBe(true); // Unchanged
        expect(responseStatus).toBe(200);
    });
     it('should return 500 on server error', async () => {
        mockRequest.body = { chainName: 'UpdatedName' };
        (Chain.findOne as jest.Mock).mockRejectedValue(new Error('DB error'));
        await updateChain(mockRequest as Request, mockResponse as Response);
        expect(responseStatus).toBe(500);
        expect(responseJson.message).toBe('Internal server error while updating chain');
    });
  });

  describe('deleteChain', () => {
    it('should delete a chain successfully', async () => {
      mockRequest.params = { chainId: 'chainToDelete' };
      (Chain.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      await deleteChain(mockRequest as Request, mockResponse as Response);

      expect(Chain.deleteOne).toHaveBeenCalledWith({ chainId: 'chainToDelete' });
      expect(responseStatus).toBe(204);
      expect(responseSend).toBe(true);
    });

    it('should return 404 if chain to delete is not found', async () => {
      mockRequest.params = { chainId: 'nonExistent' };
      (Chain.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 });

      await deleteChain(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(404);
      expect(responseJson.message).toBe('Chain not found');
    });
     it('should return 500 on server error', async () => {
      mockRequest.params = { chainId: 'errorChain' };
      (Chain.deleteOne as jest.Mock).mockRejectedValue(new Error('DB error'));
      await deleteChain(mockRequest as Request, mockResponse as Response);
      expect(responseStatus).toBe(500);
      expect(responseJson.message).toBe('Internal server error while deleting chain');
    });
  });
});
