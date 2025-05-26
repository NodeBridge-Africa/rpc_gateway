import { Router } from 'express'; // Changed this line
import { AdminController } from '../controllers/admin.controller'; // Import the controller
import { auth } from '../auth/auth'; // Or your specific admin auth middleware

const router = Router(); // Changed this line
const adminController = new AdminController(); // Instantiate the controller

// Admin endpoint to check node infrastructure health
router.get('/node-health/:chain', adminController.getNodeHealth); // Added :chain

// Get node metrics summary
router.get('/node-metrics/:chain', adminController.getNodeMetrics); // Added :chain

// The extractMetric function should now be part of AdminController
// and is no longer needed here.

// Chain Management Routes
// These routes should be protected by an admin-only authorization middleware.
// For now, using the general 'auth' middleware. Replace with specific admin middleware if available.

router.post('/chains', auth, adminController.addChain);
router.get('/chains', auth, adminController.listChains);
router.put('/chains/:chainIdToUpdate', auth, adminController.updateChain); // Use chainId in param
router.delete('/chains/:chainIdToDelete', auth, adminController.deleteChain); // Use chainId in param

// Route to update limits for a specific app
// Protected by admin auth middleware
router.put('/apps/:appId/limits', auth, adminController.updateAppLimits);

export default router;
