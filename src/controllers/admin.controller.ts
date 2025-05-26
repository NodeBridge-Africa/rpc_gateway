import { Request, Response } from 'express';
import axios from 'axios';
import { config } from '../../config'; // Import the new config

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
}
