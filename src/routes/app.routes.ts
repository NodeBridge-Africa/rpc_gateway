import { Router } from "express";
import { AppController } from "../controllers/app.controller";
import { auth } from "../middlewares/auth.middleware";

const router = Router();
const appController = new AppController();

// Route to create a new app
router.post("/", auth, appController.createApp);

// Route to get all apps for the authenticated user
router.get("/", auth, appController.getUserApps);

// Route to get dashboard statistics
router.get("/dashboard/stats", auth, appController.getUserDashboardStats);

// Route to get aggregated usage analytics for all user's apps
router.get("/usage/all", auth, appController.getAllAppsUsageAnalytics);

// Route to get a specific app by ID
router.get("/:appId", auth, appController.getUserApp);

// Route to update a specific app
router.patch("/:appId", auth, appController.updateUserApp);

// Route to delete a specific app
router.delete("/:appId", auth, appController.deleteUserApp);

// Route to regenerate API key for a specific app
router.post("/:appId/regenerate-key", auth, appController.regenerateApiKey);

// Route to get detailed usage analytics for a specific app
router.get("/:appId/usage", auth, appController.getAppUsageAnalytics);

export default router;
