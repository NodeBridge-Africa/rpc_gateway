import { Request, Response } from 'express';
// 'fetch' is globally available in Node.js 18+ environments.
// If using an older Node version or a specific fetch polyfill, ensure it's properly imported/configured.
// For this subtask, we assume 'fetch' is available.

export class ProxyController {
  public async checkProxyHealth(req: Request, res: Response): Promise<void> {
    const executionUrl = process.env.EXECUTION_RPC_URL || 'http://192.168.8.229:8545';
    const consensusUrl = process.env.CONSENSUS_API_URL || 'http://192.168.8.229:5052';

    const healthChecks = {
      execution: { url: executionUrl, status: 'unknown' },
      consensus: { url: consensusUrl, status: 'unknown' },
    };

    // Simple health check for execution layer (JSON-RPC)
    try {
      const response = await fetch(executionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      healthChecks.execution.status = response.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      healthChecks.execution.status = 'unhealthy';
    }

    // Simple health check for consensus layer (REST API)
    try {
      const response = await fetch(`${consensusUrl}/eth/v1/node/health`);
      healthChecks.consensus.status = response.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      healthChecks.consensus.status = 'unhealthy';
    }

    const allHealthy = Object.values(healthChecks).every(
      (check) => check.status === 'healthy'
    );

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks: healthChecks,
      timestamp: new Date().toISOString(),
    });
  }
}
