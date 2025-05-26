import { Request, Response } from 'express';
import axios from 'axios';
import { config } from '../../config'; // Import the new config
import Chain from '../models/chain.model';
import App from '../models/app.model'; // Import App model
import { successResponse, errorResponse } from '../utils/responseHandler';

// Helper function (can be a private static method or defined within the class methods if preferred)
function extractMetric(metricsText: string, metricName: string): string {
  const lines = metricsText.split('\n');
  for (const line of lines) {
    if (!line.startsWith('#') && line.includes(metricName)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && parts[0] === metricName) {
        return parts[1];
      }
    }
  }
  return 'not_found';
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
      res.status(400).json({ error: 'Chain parameter is missing.' });
      return;
    }

    const chainConfig = config.getChainConfig(chainName);

    if (!chainConfig || !chainConfig.executionRpcUrl || !chainConfig.consensusApiUrl) {
      res.status(404).json({ error: `Configuration not found or incomplete for chain: ${chainName}. Execution RPC URL and Consensus API URL are required.` });
      return;
    }

    const { executionRpcUrl, consensusApiUrl, prometheusUrl } = chainConfig;

    try {
      const serviceChecks = [
        // Check execution layer
        axios.post(`${executionRpcUrl}/`, {
          jsonrpc: '2.0',
          method: 'eth_syncing',
          params: [],
          id: 1,
        }),
        // Check consensus layer
        axios.get(`${consensusApiUrl}/eth/v1/node/syncing`),
      ];

      // Conditionally add Prometheus check if URL is configured
      if (prometheusUrl) {
        serviceChecks.push(axios.get(`${prometheusUrl}/metrics`, { timeout: 5000 }));
      }

      const results = await Promise.allSettled(serviceChecks);
      const [execResult, consensusResult, metricsResult] = results; // metricsResult will be undefined if prometheusUrl is not set

      const health: any = { // Use 'any' for flexibility or define a stricter type
        chain: chainName,
        timestamp: new Date().toISOString(),
        execution: {
          status: execResult.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          syncing:
            execResult.status === 'fulfilled' && execResult.value.data.result !== undefined
              ? execResult.value.data.result === false
                ? false
                : execResult.value.data.result 
              : 'unknown',
          endpoint: executionRpcUrl,
        },
        consensus: {
          status: consensusResult.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          syncing:
            consensusResult.status === 'fulfilled' && consensusResult.value.data?.data?.is_syncing !== undefined
              ? consensusResult.value.data.data.is_syncing
              : 'unknown',
          head_slot:
            consensusResult.status === 'fulfilled' && consensusResult.value.data?.data?.head_slot !== undefined
              ? consensusResult.value.data.data.head_slot
              : 'unknown',
          endpoint: consensusApiUrl,
        },
        metrics: {
          status: prometheusUrl 
            ? (metricsResult?.status === 'fulfilled' ? 'available' : 'unavailable') 
            : 'not_configured',
          endpoint: prometheusUrl || null,
        },
        overall: 'healthy', // Will be calculated below
      };
      
      // Detailed error logging for failed promises
      if (execResult.status === 'rejected') console.error(`Execution check for ${chainName} failed:`, execResult.reason);
      if (consensusResult.status === 'rejected') console.error(`Consensus check for ${chainName} failed:`, consensusResult.reason);
      if (prometheusUrl && metricsResult?.status === 'rejected') console.error(`Prometheus check for ${chainName} failed:`, metricsResult.reason);


      const unhealthyServices = [
        health.execution.status,
        health.consensus.status,
        // Only consider metrics status if it's configured and not 'available' (i.e., 'unavailable')
        prometheusUrl && health.metrics.status === 'unavailable' ? 'unhealthy' : 'healthy', 
      ].filter((status) => status === 'unhealthy').length;
      
      const servicesNotConfigured = [
        !executionRpcUrl,
        !consensusApiUrl,
        !prometheusUrl && health.metrics.status === 'not_configured' // Count if prometheus specifically is not configured
      ].filter(Boolean).length;


      if (unhealthyServices === 0) {
        health.overall = 'healthy';
      } else if (unhealthyServices === 1 && (unhealthyServices + servicesNotConfigured < 2) ) { // Allow 1 unhealthy if others are fine or not configured
        health.overall = 'degraded';
      } else {
        health.overall = 'unhealthy';
      }
      
      // If all critical services are not configured, status might be misleading
      if (!executionRpcUrl && !consensusApiUrl) {
          health.overall = 'not_configured';
      }


      res.json(health);
    } catch (error) {
      console.error(`Error in getNodeHealth for chain ${chainName}:`, error);
      res.status(500).json({
        error: 'Failed to check node health',
        details: error instanceof Error ? error.message : 'Unknown error',
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
      res.status(400).json({ error: 'Chain parameter is missing.' });
      return;
    }

    const chainConfig = config.getChainConfig(chainName);

    if (!chainConfig || !chainConfig.prometheusUrl) {
      res.status(404).json({ error: `Prometheus URL not configured for chain: ${chainName}` });
      return;
    }

    const { prometheusUrl } = chainConfig;

    try {
      const metricsResponse = await axios.get(
        `${prometheusUrl}/metrics`,
        {
          timeout: 10000,
        }
      );
      const metricsText = metricsResponse.data; // Renamed to avoid confusion

      const summary = {
        chain: chainName,
        timestamp: new Date().toISOString(),
        go_runtime: {
          gc_cycles: extractMetric(metricsText, 'go_gc_cycles_total_gc_cycles_total'),
          heap_allocs: extractMetric(metricsText, 'go_gc_heap_allocs_bytes_total'),
          goroutines: extractMetric(metricsText, 'go_goroutines'),
        },
        sync: {
          mutex_wait: extractMetric(
            metricsText,
            'go_sync_mutex_wait_total_seconds_total'
          ),
        },
        // Add more extracted metrics as needed
      };

      res.json(summary);
    } catch (error) {
      console.error(`Error in getNodeMetrics for chain ${chainName}:`, error);
      res.status(500).json({
        error: 'Failed to fetch node metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
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
        errorResponse(res, 400, 'Missing required fields: name, chainId.');
        return;
      }

      const existingChain = await Chain.findOne({ $or: [{ name }, { chainId }] });
      if (existingChain) {
        errorResponse(res, 409, `Chain with name '${name}' or chainId '${chainId}' already exists.`);
        return;
      }

      const newChain = new Chain({
        name,
        chainId,
        isEnabled: isEnabled !== undefined ? isEnabled : true, // Default to true if not provided
        adminNotes,
      });

      await newChain.save();
      successResponse(res, 201, 'Chain added successfully.', { chain: newChain });

    } catch (error) {
      console.error('Error adding chain:', error);
      errorResponse(res, 500, 'Internal server error while adding chain.', { details: (error as Error).message });
    }
  }

  /**
   * Lists all blockchain configurations currently in the system.
   * @param req Express request object.
   * @param res Express response object.
   */
  public async listChains(req: Request, res: Response): Promise<void> {
    try {
      const chains = await Chain.find();
      successResponse(res, 200, 'Chains retrieved successfully.', { chains });
    } catch (error) {
      console.error('Error listing chains:', error);
      errorResponse(res, 500, 'Internal server error while listing chains.', { details: (error as Error).message });
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
          errorResponse(res, 400, 'Chain ID to update must be provided as a URL parameter.');
          return;
      }
      
      // Ensure at least one updatable field is provided in the request body.
      if (name === undefined && newChainId === undefined && isEnabled === undefined && adminNotes === undefined) {
          errorResponse(res, 400, 'No update fields provided. At least one of name, newChainId, isEnabled, or adminNotes must be supplied.');
          return;
      }

      const chain = await Chain.findOne({ chainId: chainIdToUpdate });
      if (!chain) {
        errorResponse(res, 404, `Chain with chainId '${chainIdToUpdate}' not found.`);
        return;
      }

      // Check for conflicts if name or newChainId is being updated
      if (name && name !== chain.name) {
          const conflictingChain = await Chain.findOne({ name });
          if (conflictingChain) {
              errorResponse(res, 409, `Another chain with name '${name}' already exists.`);
              return;
          }
          chain.name = name;
      }

      if (newChainId && newChainId !== chain.chainId) {
          const conflictingChain = await Chain.findOne({ chainId: newChainId });
          if (conflictingChain) {
              errorResponse(res, 409, `Another chain with chainId '${newChainId}' already exists.`);
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
      successResponse(res, 200, 'Chain updated successfully.', { chain });

    } catch (error) {
      console.error('Error updating chain:', error);
      errorResponse(res, 500, 'Internal server error while updating chain.', { details: (error as Error).message });
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
          errorResponse(res, 400, 'Chain ID to delete must be provided as a URL parameter.');
          return;
      }

      const result = await Chain.deleteOne({ chainId: chainIdToDelete });

      if (result.deletedCount === 0) {
        errorResponse(res, 404, `Chain with chainId '${chainIdToDelete}' not found.`);
        return;
      }

      successResponse(res, 200, 'Chain deleted successfully.');

    } catch (error) {
      console.error('Error deleting chain:', error);
      errorResponse(res, 500, 'Internal server error while deleting chain.', { details: (error as Error).message });
    }
  }

  /**
   * Updates the rate limits (maxRps and/or dailyRequestsLimit) for a specific application.
   * @param req Express request object. Expects `appId` in params, and
   *            { maxRps?, dailyRequestsLimit? } in the body.
   * @param res Express response object.
   */
  public async updateAppLimits(req: Request, res: Response): Promise<void> {
    try {
      const { appId } = req.params;
      const { maxRps, dailyRequestsLimit } = req.body;

      // Validate presence of appId
      if (!appId) {
        errorResponse(res, 400, 'App ID must be provided in the URL path.');
        return;
      }

      // Validate that at least one limit is being provided for update
      if (maxRps === undefined && dailyRequestsLimit === undefined) {
        errorResponse(res, 400, 'At least one limit (maxRps or dailyRequestsLimit) must be provided.');
        return;
      }

      const updateFields: { maxRps?: number; dailyRequestsLimit?: number } = {};
      
      // Validate and add maxRps to updateFields if provided
      if (maxRps !== undefined) {
        if (typeof maxRps !== 'number' || maxRps < 0) {
          errorResponse(res, 400, 'Invalid value for maxRps. Must be a non-negative number.');
          return;
        }
        updateFields.maxRps = maxRps;
      }

      // Validate and add dailyRequestsLimit to updateFields if provided
      if (dailyRequestsLimit !== undefined) {
        if (typeof dailyRequestsLimit !== 'number' || dailyRequestsLimit < 0) {
          errorResponse(res, 400, 'Invalid value for dailyRequestsLimit. Must be a non-negative number.');
          return;
        }
        updateFields.dailyRequestsLimit = dailyRequestsLimit;
      }

      const app = await App.findByIdAndUpdate(
        appId,
        { $set: updateFields },
        { new: true, runValidators: true }
      );

      if (!app) {
        errorResponse(res, 404, `App with ID '${appId}' not found.`);
        return;
      }

      successResponse(res, 200, 'App limits updated successfully.', { app });

    } catch (error) {
      console.error('Error updating app limits:', error);
      if ((error as any).name === 'CastError' && (error as any).path === '_id') {
           errorResponse(res, 400, 'Invalid App ID format.');
      } else if ((error as any).name === 'ValidationError') {
           errorResponse(res, 400, 'Validation error.', { details: (error as Error).message });
      } else {
           errorResponse(res, 500, 'Internal server error while updating app limits.', { details: (error as Error).message });
      }
    }
  }
}
