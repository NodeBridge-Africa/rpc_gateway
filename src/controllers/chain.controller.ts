import { Request, Response } from 'express';
import Chain, { IChain } from '../models/chain.model';

export const addChain = async (req: Request, res: Response) => {
  try {
    const { chainName, chainId, description } = req.body;

    if (!chainName || !chainId) {
      return res.status(400).json({ message: 'Missing required fields: chainName, chainId' });
    }

    const existingChain = await Chain.findOne({ $or: [{ chainName }, { chainId }] });
    if (existingChain) {
      return res.status(409).json({ message: 'Chain name or chainId already exists' });
    }

    const newChain: IChain = new Chain({
      chainName,
      chainId,
      description,
    });

    await newChain.save();
    return res.status(201).json(newChain);
  } catch (error) {
    console.error('Error adding chain:', error);
    return res.status(500).json({ message: 'Internal server error while adding chain' });
  }
};

export const listChains = async (req: Request, res: Response) => {
  try {
    const chains = await Chain.find();
    return res.status(200).json(chains);
  } catch (error) {
    console.error('Error listing chains:', error);
    return res.status(500).json({ message: 'Internal server error while listing chains' });
  }
};

export const updateChain = async (req: Request, res: Response) => {
  try {
    const { chainId: paramChainId } = req.params;
    const { chainName, description, isEnabled, chainId: newChainId } = req.body;

    const chain = await Chain.findOne({ chainId: paramChainId });
    if (!chain) {
      return res.status(404).json({ message: 'Chain not found' });
    }

    if (chainName && chainName !== chain.chainName) {
      const existingChainName = await Chain.findOne({ chainName });
      if (existingChainName) {
        return res.status(409).json({ message: 'New chainName already exists' });
      }
      chain.chainName = chainName;
    }

    if (newChainId && newChainId !== chain.chainId) {
      const existingChainId = await Chain.findOne({ chainId: newChainId });
      if (existingChainId) {
        return res.status(409).json({ message: 'New chainId already exists' });
      }
      chain.chainId = newChainId;
    }

    if (description !== undefined) {
      chain.description = description;
    }
    if (isEnabled !== undefined) {
      chain.isEnabled = isEnabled;
    }

    await chain.save();
    return res.status(200).json(chain);
  } catch (error) {
    console.error('Error updating chain:', error);
    return res.status(500).json({ message: 'Internal server error while updating chain' });
  }
};

export const deleteChain = async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params;

    const result = await Chain.deleteOne({ chainId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Chain not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting chain:', error);
    return res.status(500).json({ message: 'Internal server error while deleting chain' });
  }
};
