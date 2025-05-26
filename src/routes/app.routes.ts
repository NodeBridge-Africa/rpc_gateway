import { Router } from 'express';
import { AppController } from '../controllers/app.controller';
import { auth } from '../auth/auth'; // Assuming this is your JWT auth middleware

const router = Router();
const appController = new AppController();

// Route to create a new app
// Protected by JWT authentication middleware
router.post('/', auth, appController.createApp);

// Route to get all apps for the authenticated user
router.get('/', auth, appController.getUserApps);

export default router;
