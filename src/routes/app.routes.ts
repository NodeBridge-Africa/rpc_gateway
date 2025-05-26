import { Router } from 'express';
import { auth } from '../middlewares/auth.middleware';
import { createApp, listApps } from '../controllers/app.controller';

const router = Router();

// POST /apps - Create a new application
router.post('/', auth, createApp);

// GET /apps - List all applications for the authenticated user
router.get('/', auth, listApps);

export default router;
