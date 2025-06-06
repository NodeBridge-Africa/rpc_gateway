import { Request, Response } from "express";
import App from "../models/app.model";
import Chain from "../models/chain.model"; // Assuming chain.model.ts is created
import DefaultAppSettings from "../models/defaultAppSettings.model"; // Added import
import { successResponse, errorResponse } from "../utils/responseHandler"; // Assuming you have this
import { v4 as uuid } from "uuid"; // For API key generation if not handled by schema default

const MAX_APPS_PER_USER = 5;
// const DEFAULT_MAX_RPS = parseInt(process.env.DEFAULT_MAX_RPS || "20"); // This is now sourced from DefaultAppSettings

export class AppController {
  /**
   * Creates a new application for an authenticated user.
   * The application's initial rate limits (maxRps, dailyRequestsLimit) are sourced
   * from the global DefaultAppSettings.
   * @param req Express request object, expects { name, description?, chainName, chainId } in body.
   * @param res Express response object.
   */
  public async createApp(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, chainName, chainId } = req.body;
      const userId = req.user?._id || req.userId; // Use user from auth middleware

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      if (!name || !chainName || !chainId) {
        errorResponse(
          res,
          400,
          "Missing required fields: name, chainName, chainId."
        );
        return;
      }

      // Check app limit for the user
      const appCount = await App.countDocuments({ userId });
      if (appCount >= MAX_APPS_PER_USER) {
        errorResponse(
          res,
          403,
          `User cannot create more than ${MAX_APPS_PER_USER} apps.`
        );
        return;
      }

      // Verify chain existence and if it's enabled
      const chain = await Chain.findOne({
        name: chainName,
        chainId: chainId,
        isEnabled: true,
      });
      if (!chain) {
        errorResponse(
          res,
          404,
          `Chain '${chainName}' with chainId '${chainId}' not found or is not enabled.`
        );
        return;
      }

      // Fetch default app settings to apply to the new app.
      let appMaxRps: number;
      let appDailyRequestsLimit: number;

      const defaultSettings = await DefaultAppSettings.findOne();
      if (defaultSettings) {
        appMaxRps = defaultSettings.maxRps;
        appDailyRequestsLimit = defaultSettings.dailyRequestsLimit;
      } else {
        // Fallback logic: If no DefaultAppSettings document exists in the database,
        // use hardcoded or environment-variable-based fallbacks.
        // This situation should be unlikely if the DefaultAppSettingsController.getDefaultAppSettings
        // endpoint has been called at least once, as it creates initial settings.
        console.warn(
          "DefaultAppSettings not found. Falling back to environment/hardcoded defaults for new app."
        );
        appMaxRps = parseInt(process.env.DEFAULT_MAX_RPS || "200");
        appDailyRequestsLimit = parseInt(
          process.env.DEFAULT_DAILY_REQUESTS || "1000000"
        );
      }

      const newApp = new App({
        name,
        description,
        userId,
        chainName: chain.name,
        chainId: chain.chainId,
        apiKey: uuid(), // apiKey is generated by schema default, but can be explicit here too
        maxRps: appMaxRps, // Use fetched or fallback default
        dailyRequestsLimit: appDailyRequestsLimit, // Use fetched or fallback default
        // dailyRequests and lastResetDate will use their schema defaults
      });

      await newApp.save();
      successResponse(res, 201, {
        message: "App created successfully.",
        data: newApp,
        success: true,
      });
    } catch (error) {
      console.error("Error creating app:", error);
      errorResponse(res, 500, {
        message: "Internal server error while creating app.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Retrieves all applications belonging to the authenticated user.
   * API keys are excluded from the response for security.
   * @param req Express request object, expects authenticated user via req.user.
   * @param res Express response object.
   */
  public async getUserApps(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [apps, totalApps] = await Promise.all([
        App.find({ userId })
          .select("-apiKey")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        App.countDocuments({ userId }),
      ]);

      successResponse(res, 200, {
        message: "User applications retrieved successfully.",
        success: true,
        data: {
          apps,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalApps / limit),
            totalApps,
            hasNextPage: page < Math.ceil(totalApps / limit),
            hasPrevPage: page > 1,
          },
        },
      });
    } catch (error) {
      console.error("Error retrieving user apps:", error);
      errorResponse(res, 500, {
        message: "Internal server error while retrieving apps.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Retrieves a specific app with its API key for the authenticated user.
   * @param req Express request object with app ID in params.
   * @param res Express response object.
   */
  public async getUserApp(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      const { appId } = req.params;

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      const app = await App.findOne({ _id: appId, userId });
      if (!app) {
        errorResponse(res, 404, "App not found or access denied.");
        return;
      }

      successResponse(res, 200, {
        message: "App retrieved successfully.",
        success: true,
        data: app,
      });
    } catch (error) {
      console.error("Error retrieving user app:", error);
      errorResponse(res, 500, {
        message: "Internal server error while retrieving app.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Updates an application belonging to the authenticated user.
   * @param req Express request object with app updates in body.
   * @param res Express response object.
   */
  public async updateUserApp(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      const { appId } = req.params;
      const { name, description } = req.body;

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      const app = await App.findOne({ _id: appId, userId });
      if (!app) {
        errorResponse(res, 404, "App not found or access denied.");
        return;
      }

      if (name) app.name = name;
      if (description !== undefined) app.description = description;

      await app.save();

      successResponse(res, 200, {
        message: "App updated successfully.",
        data: app,
        success: true,
      });
    } catch (error) {
      console.error("Error updating user app:", error);
      errorResponse(res, 500, {
        message: "Internal server error while updating app.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Deletes an application belonging to the authenticated user.
   * @param req Express request object with app ID in params.
   * @param res Express response object.
   */
  public async deleteUserApp(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      const { appId } = req.params;

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      const app = await App.findOne({ _id: appId, userId });
      if (!app) {
        errorResponse(res, 404, "App not found or access denied.");
        return;
      }

      await App.deleteOne({ _id: appId, userId });

      successResponse(res, 200, {
        message: "App deleted successfully.",
        success: true,
      });
    } catch (error) {
      console.error("Error deleting user app:", error);
      errorResponse(res, 500, {
        message: "Internal server error while deleting app.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Regenerates API key for an application belonging to the authenticated user.
   * @param req Express request object with app ID in params.
   * @param res Express response object.
   */
  public async regenerateApiKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      const { appId } = req.params;

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      const app = await App.findOne({ _id: appId, userId });
      if (!app) {
        errorResponse(res, 404, "App not found or access denied.");
        return;
      }

      app.apiKey = uuid();
      await app.save();

      successResponse(res, 200, {
        message: "API key regenerated successfully.",
        data: app.apiKey,
        success: true,
      });
    } catch (error) {
      console.error("Error regenerating API key:", error);
      errorResponse(res, 500, {
        message: "Internal server error while regenerating API key.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Gets user dashboard statistics.
   * @param req Express request object.
   * @param res Express response object.
   */
  public async getUserDashboardStats(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      const [totalApps, activeApps, totalRequests, todaysRequests] =
        await Promise.all([
          App.countDocuments({ userId }),
          App.countDocuments({ userId, isActive: true }),
          App.aggregate([
            { $match: { userId } },
            { $group: { _id: null, total: { $sum: "$requests" } } },
          ]).then((result) => result[0]?.total || 0),
          App.aggregate([
            { $match: { userId } },
            { $group: { _id: null, total: { $sum: "$dailyRequests" } } },
          ]).then((result) => result[0]?.total || 0),
        ]);

      successResponse(res, 200, {
        message: "Dashboard statistics retrieved successfully.",
        success: true,
        data: {
          stats: {
            totalApps,
            activeApps,
            totalRequests,
            todaysRequests,
            maxApps: MAX_APPS_PER_USER,
          },
        },
      });
    } catch (error) {
      console.error("Error retrieving dashboard stats:", error);
      errorResponse(res, 500, {
        message: "Internal server error while retrieving dashboard stats.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Gets detailed usage analytics for a specific app.
   * @param req Express request object.
   * @param res Express response object.
   */
  public async getAppUsageAnalytics(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      const { appId } = req.params;

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      const app = await App.findOne({ _id: appId, userId });
      if (!app) {
        errorResponse(res, 404, "App not found.");
        return;
      }

      // Calculate usage percentage
      const usagePercentage =
        app.dailyRequestsLimit > 0
          ? Math.round((app.dailyRequests / app.dailyRequestsLimit) * 100)
          : 0;

      // Get hourly breakdown (simplified - in production, you'd want more sophisticated time-series data)
      const now = new Date();
      const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        requests: Math.floor(Math.random() * (app.dailyRequests / 24)), // Simulated data
      }));

      successResponse(res, 200, {
        message: "App usage analytics retrieved successfully.",
        success: true,
        data: {
          analytics: {
            app: {
              id: app._id,
              name: app.name,
              chainName: app.chainName,
            },
            usage: {
              totalRequests: app.requests,
              dailyRequests: app.dailyRequests,
              dailyLimit: app.dailyRequestsLimit,
              usagePercentage,
              maxRps: app.maxRps,
              lastResetDate: app.lastResetDate,
            },
            hourlyBreakdown: hourlyData,
            // In production, you'd include more detailed analytics:
            // - Request types breakdown
            // - Error rates
            // - Response times
            // - Geographic distribution
          },
        },
      });
    } catch (error) {
      console.error("Error retrieving app usage analytics:", error);
      errorResponse(res, 500, {
        message: "Internal server error while retrieving usage analytics.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Gets aggregated usage analytics for all user's apps.
   * @param req Express request object.
   * @param res Express response object.
   */
  public async getAllAppsUsageAnalytics(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;

      if (!userId) {
        errorResponse(res, 403, "User not authenticated.");
        return;
      }

      const apps = await App.find({ userId });

      // Aggregate data across all apps
      const totalStats = apps.reduce(
        (acc, app) => ({
          totalRequests: acc.totalRequests + app.requests,
          dailyRequests: acc.dailyRequests + app.dailyRequests,
          activeApps: acc.activeApps + (app.isActive ? 1 : 0),
        }),
        { totalRequests: 0, dailyRequests: 0, activeApps: 0 }
      );

      // Get per-app summary
      const appsSummary = apps.map((app) => ({
        id: app._id,
        name: app.name,
        chainName: app.chainName,
        totalRequests: app.requests,
        dailyRequests: app.dailyRequests,
        dailyLimit: app.dailyRequestsLimit,
        usagePercentage:
          app.dailyRequestsLimit > 0
            ? Math.round((app.dailyRequests / app.dailyRequestsLimit) * 100)
            : 0,
        isActive: app.isActive,
      }));

      // Sort by daily requests (most active first)
      appsSummary.sort((a, b) => b.dailyRequests - a.dailyRequests);

      successResponse(res, 200, {
        message: "Usage analytics retrieved successfully.",
        success: true,
        data: {
          analytics: {
            summary: {
              totalApps: apps.length,
              activeApps: totalStats.activeApps,
              totalRequests: totalStats.totalRequests,
              dailyRequests: totalStats.dailyRequests,
            },
            apps: appsSummary,
            // In production, you'd include:
            // - Time series data for the last 30 days
            // - Peak usage times
            // - Chain distribution
          },
        },
      });
    } catch (error) {
      console.error("Error retrieving all apps usage analytics:", error);
      errorResponse(res, 500, {
        message: "Internal server error while retrieving usage analytics.",
        details: (error as Error).message,
      });
    }
  }
}
