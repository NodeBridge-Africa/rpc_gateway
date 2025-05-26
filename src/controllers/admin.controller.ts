import { Request, Response } from 'express';
import axios from 'axios';

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
    try {
      const prometheus = process.env.PROMETHEUS_URL;
      const checks = await Promise.allSettled([
        // Check execution layer
        axios.post(`${process.env.EXECUTION_RPC_URL}/`, {
          jsonrpc: '2.0',
          method: 'eth_syncing',
          params: [],
          id: 1,
        }),
        // Check consensus layer
        axios.get(`${process.env.CONSENSUS_API_URL}/eth/v1/node/syncing`),
        // Check Prometheus metrics (if available)
        axios.get(`${prometheus}/metrics`, { timeout: 5000 }),
      ]);

      const [execResult, consensusResult, metricsResult] = checks;

      const health = {
        timestamp: new Date().toISOString(),
        execution: {
          status: execResult.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          syncing:
            execResult.status === 'fulfilled'
              ? (execResult.value as any).data.result === false // Type assertion
                ? false
                : (execResult.value as any).data.result // Type assertion
              : 'unknown',
          endpoint: process.env.EXECUTION_RPC_URL,
        },
        consensus: {
          status: consensusResult.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          syncing:
            consensusResult.status === 'fulfilled'
              ? (consensusResult.value as any).data.data.is_syncing // Type assertion
              : 'unknown',
          head_slot:
            consensusResult.status === 'fulfilled'
              ? (consensusResult.value as any).data.data.head_slot // Type assertion
              : 'unknown',
          endpoint: process.env.CONSENSUS_API_URL,
        },
        metrics: {
          status: metricsResult.status === 'fulfilled' ? 'available' : 'unavailable',
          endpoint: 'http://192.168.8.229:9090/metrics', // This was hardcoded, consider if it should be from env
        },
        overall: 'healthy', // Will be calculated below
      };

      const unhealthyServices = [
        health.execution.status,
        health.consensus.status,
      ].filter((status) => status === 'unhealthy').length;

      if (unhealthyServices === 0) {
        health.overall = 'healthy';
      } else if (unhealthyServices === 1) {
        health.overall = 'degraded';
      } else {
        health.overall = 'unhealthy';
      }

      res.json(health);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to check node health',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  public async getNodeMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metricsResponse = await axios.get(
        'http://192.168.8.229:9090/metrics', // This was hardcoded, consider if it should be from env
        {
          timeout: 10000,
        }
      );

      const metrics = metricsResponse.data;

      const summary = {
        timestamp: new Date().toISOString(),
        go_runtime: {
          gc_cycles: extractMetric(metrics, 'go_gc_cycles_total_gc_cycles_total'),
          heap_allocs: extractMetric(metrics, 'go_gc_heap_allocs_bytes_total'),
          goroutines: extractMetric(metrics, 'go_goroutines'),
        },
        sync: {
          mutex_wait: extractMetric(
            metrics,
            'go_sync_mutex_wait_total_seconds_total'
          ),
        },
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch node metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
