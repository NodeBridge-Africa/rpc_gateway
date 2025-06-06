import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import validateRequest from "../middlewares/requestValidator";
import { adminOnly } from "../middlewares/adminOnly";
import { userUpdateValidationRules } from "../validators/admin.validators";
import { appUpdateValidationRules } from "../validators/admin.validators";
import { auth } from "../middlewares/auth.middleware";

const router = Router();
const adminController = new AdminController();

// Admin endpoint to check node infrastructure health
router.get(
  "/node-health/:chain",
  auth,
  adminOnly,
  adminController.getNodeHealth
);

// Get node metrics summary
router.get(
  "/node-metrics/:chain",
  auth,
  adminOnly,
  adminController.getNodeMetrics
);

// The extractMetric function should now be part of AdminController
// and is no longer needed here.

// Chain Management Routes
// These routes should be protected by an admin-only authorization middleware.
// For now, using the general 'auth' middleware. Replace with specific admin middleware if available.

//getting chains should be accessible to all
router.get("/chains", auth, adminController.listChains);

router.post("/chains", auth, adminOnly, adminController.addChain);
router.patch(
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

// --- New GET Routes ---

// Route to get all users
router.get("/users", auth, adminOnly, adminController.getAllUsers);

// Route to get all apps
router.get("/apps", auth, adminOnly, adminController.getAllApps);

// Route to get default app settings
router.get(
  "/default-app-settings",
  auth,
  adminOnly,
  adminController.getDefaultAppSettings
);

// Route to update default app settings
router.patch(
  "/default-app-settings",
  auth,
  adminOnly,
  adminController.updateDefaultAppSettings
);

export default router;
