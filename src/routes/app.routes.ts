import { Router } from 'express';
import { auth } from '../middlewares/auth.middleware'; // Middleware to authenticate users via JWT
import { createApp, listApps } from '../controllers/app.controller'; // Controller functions for app logic

const router = Router();

/**
 * Route to create a new Application (App).
 * Requires authentication.
 * POST /apps
 * Body: { name: string, description?: string, chainName: string, chainId: string }
 */
router.post('/', auth, createApp);

/**
 * Route to list all Applications (Apps) for the authenticated user.
 * Requires authentication.
 * GET /apps
 */
router.get('/', auth, listApps);

export default router;
