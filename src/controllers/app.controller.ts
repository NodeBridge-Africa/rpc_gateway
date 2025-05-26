import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import App, { IApp } from '../models/app.model';
import User from '../models/user.model';
import Chain from '../models/chain.model';
import { DEFAULT_APP_MAX_RPS } from '../config/constants';

interface AuthenticatedRequest extends Request {
  userId?: string; // Injected by auth middleware
}

/**
 * Handles the creation of a new Application (App) for an authenticated user.
 * An App is tied to a specific blockchain (chain) and has its own unique API key.
 */
export const createApp = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, chainName, chainId } = req.body; // User-provided app details
    const userId = req.userId; // User ID from the authenticated session

    // Validate required fields
    if (!name || !chainName || !chainId) {
      return res.status(400).json({ message: 'Missing required fields: name, chainName, chainId' });
    }

    // Ensure user is authenticated
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in request' });
    }

    // Fetch the user to check app limits and associate the app
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Enforce app creation limit (e.g., 5 apps per user)
    // TODO: Consider making this limit configurable
    if (user.appCount >= 5) {
      return res.status(403).json({ message: 'App limit reached. Maximum 5 apps allowed.' });
    }

    // Verify that the selected chain exists and is enabled
    const chain = await Chain.findOne({ chainName, chainId, isEnabled: true });
    if (!chain) {
      return res.status(400).json({ message: 'Invalid or disabled chain. Please ensure the chainName and chainId are correct and the chain is active.' });
    }

    // Generate a unique API key for the new app
    const apiKey = uuidv4();

    // Create the new app instance
    const newApp: IApp = new App({
      userId, // Associate app with the user
      name,
      description,
      apiKey,
      chainName,
      chainId,
      maxRps: DEFAULT_APP_MAX_RPS, // Set default rate limit
    });

    await newApp.save(); // Save the new app to the database

    // Increment the user's app counter
    user.appCount += 1;
    await user.save();

    return res.status(201).json(newApp); // Return the created app
  } catch (error) {
    console.error('Error creating app:', error);
    return res.status(500).json({ message: 'Internal server error while creating app' });
  }
};

/**
 * Lists all Applications (Apps) for the authenticated user.
 */
export const listApps = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId; // User ID from the authenticated session

    // Ensure user is authenticated
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found in request' });
    }

    // Fetch all apps associated with the user ID
    const apps = await App.find({ userId });
    return res.status(200).json(apps);
  } catch (error) {
    console.error('Error listing apps:', error);
    return res.status(500).json({ message: 'Internal server error while listing apps' });
  }
};
