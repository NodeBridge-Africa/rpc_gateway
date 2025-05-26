import { Router } from 'express';
import { DefaultAppSettingsController } from '../controllers/defaultAppSettings.controller';
import { auth } from '../auth/auth'; // Assuming this is your JWT auth middleware
// import { adminAuth } from '../middlewares/adminAuth.middleware'; // If you have a specific admin middleware

const router = Router();
const controller = new DefaultAppSettingsController();

// Apply admin authorization middleware here if available.
// For now, using general 'auth'. This should be replaced with a proper admin check.
// Example: router.use(auth, adminAuth);
// For this task, we assume 'auth' middleware is sufficient, or an admin check
// would be part of the 'auth' middleware or a subsequent one not specified here.

router.get('/', auth, controller.getDefaultAppSettings); // Consider adminAuth here
router.put('/', auth, controller.updateDefaultAppSettings); // Consider adminAuth here

export default router;
