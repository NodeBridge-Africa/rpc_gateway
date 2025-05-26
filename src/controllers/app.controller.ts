import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import App, { IApp } from '../models/app.model';
import User from '../models/user.model';
import Chain from '../models/chain.model';
import { DEFAULT_APP_MAX_RPS } from '../config/constants';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const createApp = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, chainName, chainId } = req.body;
    const userId = req.userId;

    if (!name || !chainName || !chainId) {
      return res.status(400).json({ message: 'Missing required fields: name, chainName, chainId' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in request' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.appCount >= 5) {
      return res.status(403).json({ message: 'App limit reached. Maximum 5 apps allowed.' });
    }

    const chain = await Chain.findOne({ chainName, chainId, isEnabled: true });
    if (!chain) {
      return res.status(400).json({ message: 'Invalid or disabled chain' });
    }

    const apiKey = uuidv4();

    const newApp: IApp = new App({
      userId,
      name,
      description,
      apiKey,
      chainName,
      chainId,
      maxRps: DEFAULT_APP_MAX_RPS,
    });

    await newApp.save();

    user.appCount += 1;
    await user.save();

    return res.status(201).json(newApp);
  } catch (error) {
    console.error('Error creating app:', error);
    return res.status(500).json({ message: 'Internal server error while creating app' });
  }
};

export const listApps = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in request' });
    }

    const apps = await App.find({ userId });
    return res.status(200).json(apps);
  } catch (error) {
    console.error('Error listing apps:', error);
    return res.status(500).json({ message: 'Internal server error while listing apps' });
  }
};
