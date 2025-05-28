import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { auth } from "../auth/auth"; // Assuming this is the correct admin auth middleware
import validateRequest from "../middlewares/requestValidator";
import { adminOnly } from "../middlewares/adminOnly";
import { userUpdateValidationRules } from "../validators/admin.validators";
import { appUpdateValidationRules } from "../validators/admin.validators";

const router = Router();
const adminController = new AdminController();

// Admin endpoint to check node infrastructure health
router.get(
  "/node-health/:chain",
  auth,
  adminOnly,
  adminController.getNodeHealth
); // Added :chain

// Get node metrics summary
router.get(
  "/node-metrics/:chain",
  auth,
  adminOnly,
  adminController.getNodeMetrics
); // Added :chain

// The extractMetric function should now be part of AdminController
// and is no longer needed here.

// Chain Management Routes
// These routes should be protected by an admin-only authorization middleware.
// For now, using the general 'auth' middleware. Replace with specific admin middleware if available.

router.post("/chains", auth, adminOnly, adminController.addChain);
router.get("/chains", auth, adminOnly, adminController.listChains);
router.put(
  "/chains/:chainIdToUpdate",
  auth,
  adminOnly,
  adminController.updateChain
); // Use chainId in param
router.delete(
  "/chains/:chainIdToDelete",
  auth,
  adminOnly,
  adminController.deleteChain
); // Use chainId in param

// --- Validation Rules ---

// --- New PATCH Routes ---

// Route to update details for a specific app
router.patch(
  "/apps/:appId",
  auth,
  adminOnly,
  appUpdateValidationRules,
  validateRequest,
  adminController.updateAppDetails
);

// Route to update details for a specific user
router.patch(
  "/users/:userId",
  auth,
  adminOnly,
  userUpdateValidationRules,
  validateRequest,
  adminController.updateUserDetails
);

export default router;
