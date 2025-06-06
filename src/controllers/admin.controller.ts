import { Request, Response } from "express";
import axios from "axios";
import { config } from "../config"; // Import the new config
import Chain from "../models/chain.model";
import App from "../models/app.model"; // Import App model
import User from "../models/user.model"; // Import User model
import DefaultAppSettings from "../models/defaultAppSettings.model"; // Import DefaultAppSettings model
import { successResponse, errorResponse } from "../utils/responseHandler";

// Helper function (can be a private static method or defined within the class methods if preferred)
function extractMetric(metricsText: string, metricName: string): string {
  const lines = metricsText.split("\n");
  for (const line of lines) {
    if (!line.startsWith("#") && line.includes(metricName)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && parts[0] === metricName) {
        return parts[1];
      }
    }
  }
  return "not_found";
}

export class AdminController {
  /**
   * Retrieves the health status of a specified blockchain node.
   * This includes execution layer, consensus layer, and optionally Prometheus metrics.
   * @param req Express request object, expects `chain` name in params.
   * @param res Express response object.
   */
  public async getNodeHealth(req: Request, res: Response): Promise<void> {
    const chainName = req.params.chain?.toLowerCase();
    if (!chainName) {
      res.status(400).json({ error: "Chain parameter is missing." });
      return;
    }

    const chainConfig = config.getChainConfig(chainName);

    if (
      !chainConfig ||
      !chainConfig.executionRpcUrl ||
      !chainConfig.consensusApiUrl
    ) {
      res.status(404).json({
        error: `Configuration not found or incomplete for chain: ${chainName}. Execution RPC URL and Consensus API URL are required.`,
      });
      return;
    }

    const { executionRpcUrl, consensusApiUrl, prometheusUrl } = chainConfig;

    try {
      const serviceChecks: Promise<any>[] = [];

      // Check execution layer nodes
      let executionChecks: Promise<any>[] = [];
      if (executionRpcUrl && executionRpcUrl.length > 0) {
        executionChecks = executionRpcUrl.map((url) =>
          axios.post(
            `${url}/`,
            {
              jsonrpc: "2.0",
              method: "eth_syncing",
              params: [],
              id: 1,
            },
            { timeout: 50000 }
          )
        );
        serviceChecks.push(...executionChecks);
      }

      // Check consensus layer nodes
      let consensusChecks: Promise<any>[] = [];
      if (consensusApiUrl && consensusApiUrl.length > 0) {
        consensusChecks = consensusApiUrl.map((url) =>
          axios.get(`${url}/eth/v1/node/syncing`, { timeout: 50000 })
        );
        serviceChecks.push(...consensusChecks);
      }

      // Add Prometheus checks if URLs are configured
      let prometheusChecks: Promise<any>[] = [];
      if (prometheusUrl && prometheusUrl.length > 0) {
        prometheusChecks = prometheusUrl.map((url) =>
          axios.get(`${url}/metrics`, { timeout: 50000 })
        );
        serviceChecks.push(...prometheusChecks);
      }

      const results = await Promise.allSettled(serviceChecks);

      // Split results by service type
      let currentIndex = 0;
      const executionResults = results.slice(
        currentIndex,
        currentIndex + executionChecks.length
      );
      currentIndex += executionChecks.length;

      const consensusResults = results.slice(
        currentIndex,
        currentIndex + consensusChecks.length
      );
      currentIndex += consensusChecks.length;

      const metricsResults = results.slice(
        currentIndex,
        currentIndex + prometheusChecks.length
      );

      // Process execution layer results
      let executionNodes: any[] = [];
      if (executionRpcUrl && executionRpcUrl.length > 0) {
        executionNodes = executionResults.map((result, index) => ({
          nodeIndex: index,
          nodeUrl: executionRpcUrl[index],
          status: result.status === "fulfilled" ? "available" : "unavailable",
          syncing:
            result.status === "fulfilled" &&
            result.value.data.result !== undefined
              ? result.value.data.result === false
                ? false
                : result.value.data.result
              : "unknown",
          error:
            result.status === "rejected"
              ? result.reason instanceof Error
                ? result.reason.message
                : "Unknown error"
              : null,
        }));
      }

      // Process consensus layer results
      let consensusNodes: any[] = [];
      if (consensusApiUrl && consensusApiUrl.length > 0) {
        consensusNodes = consensusResults.map((result, index) => ({
          nodeIndex: index,
          nodeUrl: consensusApiUrl[index],
          status: result.status === "fulfilled" ? "available" : "unavailable",
          syncing:
            result.status === "fulfilled" &&
            result.value.data?.data?.is_syncing !== undefined
              ? result.value.data.data.is_syncing
              : "unknown",
          head_slot:
            result.status === "fulfilled" &&
            result.value.data?.data?.head_slot !== undefined
              ? result.value.data.data.head_slot
              : "unknown",
          error:
            result.status === "rejected"
              ? result.reason instanceof Error
                ? result.reason.message
                : "Unknown error"
              : null,
        }));
      }

      // Process prometheus results
      let prometheusNodes: any[] = [];
      if (prometheusUrl && prometheusUrl.length > 0) {
        prometheusNodes = metricsResults.map((result, index) => ({
          nodeIndex: index,
          nodeUrl: prometheusUrl[index],
          status: result.status === "fulfilled" ? "available" : "unavailable",
          error:
            result.status === "rejected"
              ? result.reason instanceof Error
                ? result.reason.message
                : "Unknown error"
              : null,
        }));
      }

      const health: any = {
        chain: chainName,
        timestamp: new Date().toISOString(),
        execution: {
          status:
            executionRpcUrl && executionRpcUrl.length > 0
              ? executionNodes.some((n) => n.status === "available")
                ? "healthy"
                : "unhealthy"
              : "not_configured",
          totalNodes: executionRpcUrl ? executionRpcUrl.length : 0,
          availableNodes: executionNodes.filter((n) => n.status === "available")
            .length,
          nodes: executionNodes,
        },
        consensus: {
          status:
            consensusApiUrl && consensusApiUrl.length > 0
              ? consensusNodes.some((n) => n.status === "available")
                ? "healthy"
                : "unhealthy"
              : "not_configured",
          totalNodes: consensusApiUrl ? consensusApiUrl.length : 0,
          availableNodes: consensusNodes.filter((n) => n.status === "available")
            .length,
          nodes: consensusNodes,
        },
        metrics: {
          status:
            prometheusUrl && prometheusUrl.length > 0
              ? prometheusNodes.some((n) => n.status === "available")
                ? "available"
                : "unavailable"
              : "not_configured",
          totalNodes: prometheusUrl ? prometheusUrl.length : 0,
          availableNodes: prometheusNodes.filter(
            (n) => n.status === "available"
          ).length,
          nodes: prometheusNodes,
        },
        overall: "healthy", // Will be calculated below
      };

      // Detailed error logging for failed nodes
      executionNodes.forEach((node) => {
        if (node.error) {
          console.error(
            `Execution check for ${chainName} at ${node.nodeUrl} failed:`,
            node.error
          );
        }
      });

      consensusNodes.forEach((node) => {
        if (node.error) {
          console.error(
            `Consensus check for ${chainName} at ${node.nodeUrl} failed:`,
            node.error
          );
        }
      });

      prometheusNodes.forEach((node) => {
        if (node.error) {
          console.error(
            `Prometheus check for ${chainName} at ${node.nodeUrl} failed:`,
            node.error
          );
        }
      });

      const unhealthyServices = [
        health.execution.status,
        health.consensus.status,
        // Only consider metrics unhealthy if ALL prometheus nodes are unavailable
        prometheusUrl &&
        prometheusUrl.length > 0 &&
        health.metrics.status === "unavailable"
          ? "unhealthy"
          : "healthy",
      ].filter((status) => status === "unhealthy").length;

      const servicesNotConfigured = [
        !executionRpcUrl || executionRpcUrl.length === 0,
        !consensusApiUrl || consensusApiUrl.length === 0,
        !prometheusUrl || prometheusUrl.length === 0,
      ].filter(Boolean).length;

      if (unhealthyServices === 0) {
        health.overall = "healthy";
      } else if (
        unhealthyServices === 1 &&
        unhealthyServices + servicesNotConfigured < 2
      ) {
        // Allow 1 unhealthy if others are fine or not configured
        health.overall = "degraded";
      } else {
        health.overall = "unhealthy";
      }

      // If all critical services are not configured, status might be misleading
      if (
        (!executionRpcUrl || executionRpcUrl.length === 0) &&
        (!consensusApiUrl || consensusApiUrl.length === 0)
      ) {
        health.overall = "not_configured";
      }

      successResponse(res, 200, {
        success: true,
        data: health,
      });
    } catch (error) {
      console.error(`Error in getNodeHealth for chain ${chainName}:`, error);
      errorResponse(res, 500, {
        error: "Failed to fetch node health",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Retrieves a summary of metrics from a specified blockchain node's Prometheus endpoint.
   * @param req Express request object, expects `chain` name in params.
   * @param res Express response object.
   */
  public async getNodeMetrics(req: Request, res: Response): Promise<void> {
    const chainName = req.params.chain?.toLowerCase();
    if (!chainName) {
      res.status(400).json({ error: "Chain parameter is missing." });
      return;
    }

    const chainConfig = config.getChainConfig(chainName);

    if (
      !chainConfig ||
      !chainConfig.prometheusUrl ||
      chainConfig.prometheusUrl.length === 0
    ) {
      res.status(404).json({
        error: `Prometheus URL not configured for chain: ${chainName}`,
      });
      return;
    }

    const { prometheusUrl } = chainConfig;

    try {
      // Fetch metrics from all prometheus URLs in parallel
      const metricsPromises = prometheusUrl.map(async (url, index) => {
        try {
          const metricsResponse = await axios.get(`${url}/metrics`, {
            timeout: 10000,
          });
          const metricsText = metricsResponse.data;

          return {
            nodeIndex: index,
            nodeUrl: url,
            status: "available",
            metrics: {
              go_runtime: {
                gc_cycles: extractMetric(
                  metricsText,
                  "go_gc_cycles_total_gc_cycles_total"
                ),
                heap_allocs: extractMetric(
                  metricsText,
                  "go_gc_heap_allocs_bytes_total"
                ),
                goroutines: extractMetric(metricsText, "go_goroutines"),
              },
              sync: {
                mutex_wait: extractMetric(
                  metricsText,
                  "go_sync_mutex_wait_total_seconds_total"
                ),
              },
              // Add more extracted metrics as needed
            },
          };
        } catch (error) {
          console.error(`Error fetching metrics from ${url}:`, error);
          return {
            nodeIndex: index,
            nodeUrl: url,
            status: "unavailable",
            error: error instanceof Error ? error.message : "Unknown error",
            metrics: null,
          };
        }
      });

      const nodeMetrics = await Promise.all(metricsPromises);

      const summary = {
        chain: chainName,
        timestamp: new Date().toISOString(),
        totalNodes: prometheusUrl.length,
        availableNodes: nodeMetrics.filter((n) => n.status === "available")
          .length,
        nodes: nodeMetrics,
      };

      successResponse(res, 200, {
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error(`Error in getNodeMetrics for chain ${chainName}:`, error);
      errorResponse(res, 500, {
        error: "Failed to fetch node metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Chain Management Methods
  /**
   * Adds a new blockchain configuration to the system.
   * @param req Express request object, expects { name, chainId, isEnabled?, adminNotes? } in body.
   * @param res Express response object.
   */
  public async addChain(req: Request, res: Response): Promise<void> {
    try {
      const { name, chainId, isEnabled, adminNotes } = req.body;

      if (!name || !chainId) {
        errorResponse(res, 400, "Missing required fields: name, chainId.");
        return;
      }

      const existingChain = await Chain.findOne({
        $or: [{ name }, { chainId }],
      });
      if (existingChain) {
        errorResponse(
          res,
          409,
          `Chain with name '${name}' or chainId '${chainId}' already exists.`
        );
        return;
      }

      const newChain = new Chain({
        name,
        chainId,
        isEnabled: isEnabled !== undefined ? isEnabled : true, // Default to true if not provided
        adminNotes,
      });

      await newChain.save();
      successResponse(res, 201, {
        message: "Chain added successfully.",
        success: true,
        data: newChain,
      });
    } catch (error) {
      console.error("Error adding chain:", error);
      errorResponse(res, 500, {
        message: "Internal server error while adding chain.",
      });
    }
  }

  /**
   * Lists all blockchain configurations currently in the system.
   * @param req Express request object.
   * @param res Express response object.
   */
  public async listChains(req: Request, res: Response): Promise<void> {
    try {
      const chains = await Chain.find().sort({ createdAt: -1 });
      successResponse(res, 200, {
        success: true,
        data: chains,
      });
    } catch (error) {
      console.error("Error listing chains:", error);
      errorResponse(res, 500, {
        message: "Internal server error while listing chains.",
      });
    }
  }

  /**
   * Updates an existing blockchain configuration.
   * @param req Express request object, expects `chainIdToUpdate` in params and
   *            { name?, newChainId?, isEnabled?, adminNotes? } in body.
   * @param res Express response object.
   */
  public async updateChain(req: Request, res: Response): Promise<void> {
    try {
      const { chainIdToUpdate } = req.params;
      const { name, newChainId, isEnabled, adminNotes } = req.body;

      if (!chainIdToUpdate) {
        errorResponse(
          res,
          400,
          "Chain ID to update must be provided as a URL parameter."
        );
        return;
      }

      // Ensure at least one updatable field is provided in the request body.
      if (
        name === undefined &&
        newChainId === undefined &&
        isEnabled === undefined &&
        adminNotes === undefined
      ) {
        errorResponse(
          res,
          400,
          "No update fields provided. At least one of name, newChainId, isEnabled, or adminNotes must be supplied."
        );
        return;
      }

      const chain = await Chain.findOne({ chainId: chainIdToUpdate });
      if (!chain) {
        errorResponse(
          res,
          404,
          `Chain with chainId '${chainIdToUpdate}' not found.`
        );
        return;
      }

      // Check for conflicts if name or newChainId is being updated
      if (name && name !== chain.name) {
        const conflictingChain = await Chain.findOne({ name });
        if (conflictingChain) {
          errorResponse(
            res,
            409,
            `Another chain with name '${name}' already exists.`
          );
          return;
        }
        chain.name = name;
      }

      if (newChainId && newChainId !== chain.chainId) {
        const conflictingChain = await Chain.findOne({ chainId: newChainId });
        if (conflictingChain) {
          errorResponse(
            res,
            409,
            `Another chain with chainId '${newChainId}' already exists.`
          );
          return;
        }
        chain.chainId = newChainId;
      }

      if (isEnabled !== undefined) {
        chain.isEnabled = isEnabled;
      }
      if (adminNotes !== undefined) {
        chain.adminNotes = adminNotes;
      }

      await chain.save();
      successResponse(res, 200, {
        message: "Chain updated successfully.",
        success: true,
        data: chain,
      });
    } catch (error) {
      console.error("Error updating chain:", error);
      errorResponse(res, 500, {
        message: "Internal server error while updating chain.",
      });
    }
  }

  /**
   * Deletes a blockchain configuration from the system.
   * @param req Express request object, expects `chainIdToDelete` in params.
   * @param res Express response object.
   */
  public async deleteChain(req: Request, res: Response): Promise<void> {
    try {
      const { chainIdToDelete } = req.params;

      if (!chainIdToDelete) {
        errorResponse(
          res,
          400,
          "Chain ID to delete must be provided as a URL parameter."
        );
        return;
      }

      const result = await Chain.deleteOne({ chainId: chainIdToDelete });

      if (result.deletedCount === 0) {
        errorResponse(
          res,
          404,
          `Chain with chainId '${chainIdToDelete}' not found.`
        );
        return;
      }

      successResponse(res, 200, {
        message: "Chain deleted successfully.",
        success: true,
      });
    } catch (error) {
      console.error("Error deleting chain:", error);
      errorResponse(res, 500, {
        message: "Internal server error while deleting chain.",
      });
    }
  }

  /**
   * Updates details for a specific application.
   * @param req Express request object. Expects `appId` in params, and
   *            various app fields in the body.
   * @param res Express response object.
   */
  public async updateAppDetails(req: Request, res: Response): Promise<void> {
    try {
      const { appId } = req.params;
      const updateData = req.body;

      if (!appId) {
        errorResponse(res, 400, "App ID must be provided in the URL path.");
        return;
      }

      const allowedAppFields = [
        "name",
        "description",
        "userId",
        "chainName",
        "chainId",
        "maxRps",
        "dailyRequestsLimit",
        "isActive",
        "apiKey",
        "requests",
        "dailyRequests",
        "lastResetDate",
      ];

      const filteredUpdateData: any = {};
      for (const key in updateData) {
        if (allowedAppFields.includes(key) && updateData[key] !== undefined) {
          // Special handling for apiKey: if provided as empty string, treat as undefined
          // to prevent setting an empty API key. Actual regeneration should be a separate endpoint.
          if (key === "apiKey" && updateData[key] === "") {
            continue;
          }
          filteredUpdateData[key] = updateData[key];
        }
      }

      if (Object.keys(filteredUpdateData).length === 0) {
        errorResponse(res, 400, "No valid fields provided for update.");
        return;
      }

      // If apiKey is being updated, ensure it's a valid format (e.g., UUID)
      // This should ideally be handled by Joi validation layer before this controller.
      // For now, we assume if it's present in filteredUpdateData, it's valid.

      const app = await App.findByIdAndUpdate(
        appId,
        { $set: filteredUpdateData },
        { new: true, runValidators: true }
      );

      if (!app) {
        errorResponse(res, 404, {
          message: `App with ID '${appId}' not found.`,
        });
        return;
      }

      successResponse(res, 200, {
        message: "App details updated successfully.",
        success: true,
        data: app.toObject(), // Convert Mongoose document to plain object
      });
    } catch (error) {
      console.error("Error updating app details:", error);
      if (
        (error as any).name === "CastError" &&
        (error as any).path === "_id"
      ) {
        errorResponse(res, 400, "Invalid App ID format.");
      } else if ((error as any).name === "ValidationError") {
        errorResponse(res, 400, "Validation error.");
      } else {
        errorResponse(
          res,
          500,
          "Internal server error while updating app details."
        );
      }
    }
  }

  /**
   * Updates details for a specific user.
   * @param req Express request object. Expects `userId` in params, and
   *            { email?, password?, isActive? } in the body.
   * @param res Express response object.
   */
  public async updateUserDetails(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const updateData = req.body;

      if (!userId) {
        errorResponse(res, 400, "User ID must be provided in the URL path.");
        return;
      }

      const allowedUserFields = ["email", "password", "isActive"];
      const filteredUpdateData: any = {};
      for (const key in updateData) {
        if (allowedUserFields.includes(key) && updateData[key] !== undefined) {
          // Ensure password is not an empty string if provided
          if (key === "password" && updateData[key] === "") {
            errorResponse(res, 400, "Password cannot be an empty string.");
            return;
          }
          filteredUpdateData[key] = updateData[key];
        }
      }

      if (Object.keys(filteredUpdateData).length === 0) {
        errorResponse(res, 400, "No valid fields provided for update.");
        return;
      }

      if (filteredUpdateData.password) {
        const user = await User.findById(userId);
        if (!user) {
          errorResponse(res, 404, {
            message: `User with ID '${userId}' not found.`,
          });
          return;
        }

        if (filteredUpdateData.email !== undefined) {
          user.email = filteredUpdateData.email;
        }
        if (filteredUpdateData.isActive !== undefined) {
          user.isActive = filteredUpdateData.isActive;
        }
        user.password = filteredUpdateData.password; // pre-save hook will hash

        await user.save();
        // user.toJSON() is automatically called by Express res.json() if User model schema has toJSON transform
        // but to be explicit and ensure password is not in the returned object from this method:
        const userObject = user.toObject(); // Or toJSON(), depending on Mongoose setup
        delete (userObject as any).password;

        successResponse(res, 200, {
          message: "User details updated successfully.",
          success: true,
          data: userObject,
        });
      } else {
        // No password update, can use findByIdAndUpdate
        const user = await User.findByIdAndUpdate(
          userId,
          { $set: filteredUpdateData },
          { new: true, runValidators: true }
        );

        if (!user) {
          errorResponse(res, 404, {
            message: `User with ID '${userId}' not found.`,
          });
          return;
        }
        const userObject = user.toObject();
        delete (userObject as any).password;

        successResponse(res, 200, {
          message: "User details updated successfully.",
          success: true,
          data: userObject,
        });
      }
    } catch (error) {
      console.error("Error updating user details:", error);
      if ((error as any).code === 11000) {
        // Mongoose duplicate key error for email
        errorResponse(
          res,
          409,
          "Email address is already in use by another account."
        );
      } else if (
        (error as any).name === "CastError" &&
        (error as any).path === "_id"
      ) {
        errorResponse(res, 400, "Invalid User ID format.");
      } else if ((error as any).name === "ValidationError") {
        errorResponse(res, 400, "Validation error.");
      } else {
        errorResponse(
          res,
          500,
          "Internal server error while updating user details."
        );
      }
    }
  }

  /**
   * Get all users with pagination
   * @param req Express request object, expects optional query params: page, limit
   * @param res Express response object
   */
  public async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const users = await User.find({}, { password: 0 }) // Exclude password field
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments();

      successResponse(res, 200, {
        success: true,
        data: {
          users: users,
          total: total,
          page: page,
          limit: limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      errorResponse(res, 500, "Internal server error while fetching users.");
    }
  }

  /**
   * Get all apps with pagination
   * @param req Express request object, expects optional query params: page, limit, userId
   * @param res Express response object
   */
  public async getAllApps(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.query.userId as string;
      const skip = (page - 1) * limit;

      // Build filter object
      const filter: any = {};
      if (userId) {
        filter.userId = userId;
      }

      const apps = await App.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await App.countDocuments(filter);

      successResponse(res, 200, {
        success: true,
        data: {
          apps: apps,
          total: total,
          page: page,
          limit: limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching apps:", error);
      errorResponse(res, 500, "Internal server error while fetching apps.");
    }
  }

  /**
   * Get default app settings
   * @param req Express request object
   * @param res Express response object
   */
  public async getDefaultAppSettings(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      let settings = await DefaultAppSettings.findOne();

      // If no settings exist, create default ones
      if (!settings) {
        settings = await DefaultAppSettings.create({
          maxRps: process.env.DEFAULT_MAX_RPS || 10,
          dailyRequestsLimit: process.env.DEFAULT_DAILY_REQUESTS || 10000,
        });
      }

      successResponse(res, 200, {
        succuss: true,
        data: settings,
      });
    } catch (error) {
      console.error("Error fetching default app settings:", error);
      errorResponse(
        res,
        500,
        "Internal server error while fetching default app settings."
      );
    }
  }

  /**
   * Update default app settings
   * @param req Express request object, expects { maxRps?, dailyRequestsLimit? } in body
   * @param res Express response object
   */
  public async updateDefaultAppSettings(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { maxRps, dailyRequestsLimit } = req.body;

      if (maxRps === undefined && dailyRequestsLimit === undefined) {
        errorResponse(
          res,
          400,
          "At least one field (maxRps or dailyRequestsLimit) must be provided."
        );
        return;
      }

      const updateData: {
        maxRps?: number;
        dailyRequestsLimit?: number;
      } = {};
      if (maxRps !== undefined) updateData.maxRps = maxRps;
      if (dailyRequestsLimit !== undefined)
        updateData.dailyRequestsLimit = dailyRequestsLimit;

      let settings = await DefaultAppSettings.findOneAndUpdate(
        {},
        { $set: updateData },
        { new: true, upsert: true, runValidators: true }
      );

      successResponse(res, 200, {
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error("Error updating default app settings:", error);
      errorResponse(
        res,
        500,
        "Internal server error while updating default app settings."
      );
    }
  }
}
