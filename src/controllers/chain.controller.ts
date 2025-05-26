import { Request, Response } from 'express';
import Chain, { IChain } from '../models/chain.model';

/**
 * Adds a new blockchain (Chain) to the system.
 * This is an admin-only operation.
 * A Chain defines a blockchain that users can create Applications (Apps) for.
 */
export const addChain = async (req: Request, res: Response) => {
  try {
    const { chainName, chainId, description } = req.body;

    // Validate required fields
    if (!chainName || !chainId) {
      return res.status(400).json({ message: 'Missing required fields: chainName, chainId' });
    }

    // Check if a chain with the same name or ID already exists to prevent duplicates
    const existingChain = await Chain.findOne({ $or: [{ chainName }, { chainId }] });
    if (existingChain) {
      return res.status(409).json({ message: 'Chain name or chainId already exists' });
    }

    // Create new chain instance
    const newChain: IChain = new Chain({
      chainName,
      chainId,
      description, // Optional description
    });

    await newChain.save(); // Save the new chain to the database
    return res.status(201).json(newChain);
  } catch (error) {
    console.error('Error adding chain:', error);
    return res.status(500).json({ message: 'Internal server error while adding chain' });
  }
};

/**
 * Lists all configured Chains in the system.
 * This is an admin-only operation.
 */
export const listChains = async (req: Request, res: Response) => {
  try {
    // Fetch all chains from the database
    const chains = await Chain.find();
    return res.status(200).json(chains);
  } catch (error) {
    console.error('Error listing chains:', error);
    return res.status(500).json({ message: 'Internal server error while listing chains' });
  }
};

/**
 * Updates an existing Chain's details.
 * This is an admin-only operation.
 * Allows updating chainName, chainId, description, and isEnabled status.
 */
export const updateChain = async (req: Request, res: Response) => {
  try {
    const { chainId: paramChainId } = req.params; // ChainId from URL parameter
    const { chainName, description, isEnabled, chainId: newChainId } = req.body; // Fields to update

    // Find the chain to be updated
    const chain = await Chain.findOne({ chainId: paramChainId });
    if (!chain) {
      return res.status(404).json({ message: 'Chain not found' });
    }

    // If chainName is being updated, check for uniqueness
    if (chainName && chainName !== chain.chainName) {
      const existingChainName = await Chain.findOne({ chainName });
      if (existingChainName) {
        return res.status(409).json({ message: 'New chainName already exists' });
      }
      chain.chainName = chainName;
    }

    // If chainId is being updated, check for uniqueness
    if (newChainId && newChainId !== chain.chainId) {
      const existingChainId = await Chain.findOne({ chainId: newChainId });
      if (existingChainId) {
        return res.status(409).json({ message: 'New chainId already exists' });
      }
      chain.chainId = newChainId;
    }

    // Update optional fields if provided
    if (description !== undefined) {
      chain.description = description;
    }
    if (isEnabled !== undefined) {
      chain.isEnabled = isEnabled;
    }

    await chain.save(); // Save the updated chain
    return res.status(200).json(chain);
  } catch (error) {
    console.error('Error updating chain:', error);
    return res.status(500).json({ message: 'Internal server error while updating chain' });
  }
};

/**
 * Deletes a Chain from the system.
 * This is an admin-only operation.
 * Note: Consider implications if Apps are currently using this chain.
 * (Current implementation allows deletion; future enhancements might prevent deletion of active chains).
 */
export const deleteChain = async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params; // ChainId from URL parameter

    // Attempt to delete the chain
    const result = await Chain.deleteOne({ chainId });

    // If no chain was deleted, it means it wasn't found
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Chain not found' });
    }

    return res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    console.error('Error deleting chain:', error);
    return res.status(500).json({ message: 'Internal server error while deleting chain' });
  }
};
