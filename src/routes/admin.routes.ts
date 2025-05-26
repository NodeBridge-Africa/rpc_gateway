import { Router } from 'express'; // Changed this line
import { AdminController } from '../controllers/admin.controller'; // Import the controller

const router = Router(); // Changed this line
const adminController = new AdminController(); // Instantiate the controller

// Admin endpoint to check node infrastructure health
router.get('/node-health', adminController.getNodeHealth);

// Get node metrics summary
router.get('/node-metrics', adminController.getNodeMetrics);

// The extractMetric function should now be part of AdminController
// and is no longer needed here.

export default router;
