import { Request, Response } from 'express';
import { config } from '../../config'; // Import config

// 'fetch' is globally available in Node.js 18+ environments.
// If using an older Node version or a specific fetch polyfill, ensure it's properly imported/configured.
// For this subtask, we assume 'fetch' is available.

export class ProxyController {
  public async checkProxyHealth(req: Request, res: Response): Promise<void> {
    const chainName = req.params.chain?.toLowerCase();
    if (!chainName) {
      res.status(400).json({ error: 'Chain parameter is missing.' });
      return;
    }

    const chainConfig = config.getChainConfig(chainName);

    if (!chainConfig) {
      res.status(404).json({ error: `Configuration for chain '${chainName}' not found.` });
      return;
    }

    const { executionRpcUrl, consensusApiUrl } = chainConfig;

    if (!executionRpcUrl && !consensusApiUrl) {
        res.status(404).json({ error: `No RPC/API URLs configured for chain '${chainName}'.` });
        return;
    }
    
    const healthChecks: any = {}; // Use 'any' for flexibility or define a stricter type

    // Check execution layer if URL is configured
    if (executionRpcUrl) {
      healthChecks.execution = { url: executionRpcUrl, status: 'unhealthy' };
      try {
        const response = await fetch(executionRpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
          timeout: 5000, // Add timeout
        });
        healthChecks.execution.status = response.ok ? 'healthy' : 'unhealthy';
      } catch (error) {
        healthChecks.execution.status = 'unhealthy';
        console.error(`Health check failed for ${chainName} execution: ${error}`);
      }
    } else {
      healthChecks.execution = { url: null, status: 'not_configured' };
    }

    // Check consensus layer if URL is configured
    if (consensusApiUrl) {
      healthChecks.consensus = { url: consensusApiUrl, status: 'unhealthy' };
      try {
        const response = await fetch(`${consensusApiUrl}/eth/v1/node/health`, { timeout: 5000 }); // Add timeout
        healthChecks.consensus.status = response.ok ? 'healthy' : 'unhealthy';
      } catch (error) {
        healthChecks.consensus.status = 'unhealthy';
        console.error(`Health check failed for ${chainName} consensus: ${error}`);
      }
    } else {
      healthChecks.consensus = { url: null, status: 'not_configured' };
    }
    
    const allHealthy = Object.values(healthChecks).every(
      (check: any) => check.status === 'healthy' || check.status === 'not_configured'
    );
    const anyUnhealthy = Object.values(healthChecks).some(
        (check: any) => check.status === 'unhealthy'
    );

    let overallStatus = 'healthy';
    if (anyUnhealthy) {
        overallStatus = 'unhealthy';
    } else if (!allHealthy && !Object.values(healthChecks).some((check: any) => check.status === 'healthy')) {
        // This case means everything is 'not_configured'
        overallStatus = 'not_configured';
    }


    res.status(anyUnhealthy ? 503 : 200).json({
      status: overallStatus,
      chain: chainName,
      checks: healthChecks,
      timestamp: new Date().toISOString(),
    });
  }
}
