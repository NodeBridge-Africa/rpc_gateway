import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { auth } from "../auth/auth"; // Assuming this is the correct admin auth middleware
import { body, param } from "express-validator";
import validateRequest from "../middlewares/requestValidator";
import { adminOnly } from "../middlewares/adminOnly";

const router = Router();
const adminController = new AdminController();

// Admin endpoint to check node infrastructure health
router.get("/node-health/:chain", adminController.getNodeHealth); // Added :chain

// Get node metrics summary
router.get("/node-metrics/:chain", adminController.getNodeMetrics); // Added :chain

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

// Route to update limits for a specific app
// Protected by admin auth middleware
router.put("/apps/:appId/limits", auth, adminController.updateAppLimits);

// --- Validation Rules ---

const appUpdateValidationRules = [
  param("appId").isMongoId().withMessage("Invalid App ID format"),
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("userId")
    .optional()
    .isMongoId()
    .withMessage("Invalid User ID format for userId field"),
  body("chainName")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("chainName must be between 1 and 50 characters"),
  body("chainId")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("chainId must be between 1 and 50 characters"),
  body("maxRps")
    .optional()
    .isInt({ min: 0 })
    .withMessage("maxRps must be a non-negative integer"),
  body("dailyRequestsLimit")
    .optional()
    .isInt({ min: 0 })
    .withMessage("dailyRequestsLimit must be a non-negative integer"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("apiKey")
    .optional()
    .isUUID(4)
    .withMessage("apiKey must be a valid UUID v4"),
  body("requests")
    .optional()
    .isInt({ min: 0 })
    .withMessage("requests must be a non-negative integer"),
  body("dailyRequests")
    .optional()
    .isInt({ min: 0 })
    .withMessage("dailyRequests must be a non-negative integer"),
  body("lastResetDate")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("lastResetDate must be a valid ISO 8601 date"),
  body().custom((value, { req }) => {
    const validKeys = Object.keys(req.body).filter(
      (key) => req.body[key] !== undefined
    );
    if (validKeys.length === 0) {
      throw new Error(
        "Request body cannot be empty and must contain at least one valid field for update."
      );
    }
    return true;
  }),
];

const userUpdateValidationRules = [
  param("userId").isMongoId().withMessage("Invalid User ID format"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email format"),
  body("password")
    .optional()
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body().custom((value, { req }) => {
    const validKeys = Object.keys(req.body).filter(
      (key) => req.body[key] !== undefined
    );
    if (validKeys.length === 0) {
      throw new Error(
        "Request body cannot be empty and must contain at least one valid field for update."
      );
    }
    return true;
  }),
];

// --- New PATCH Routes ---

// Route to update details for a specific app
router.patch(
  "/apps/:appId",
  auth,
  appUpdateValidationRules,
  validateRequest,
  adminController.updateAppDetails
);

// Route to update details for a specific user
router.patch(
  "/users/:userId",
  auth,
  userUpdateValidationRules,
  validateRequest,
  adminController.updateUserDetails
);

export default router;
