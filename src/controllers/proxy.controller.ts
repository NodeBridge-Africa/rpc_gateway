import { Request, Response } from "express";
import { config } from "../config"; // Import config

// 'fetch' is globally available in Node.js 18+ environments.
// If using an older Node version or a specific fetch polyfill, ensure it's properly imported/configured.
// For this subtask, we assume 'fetch' is available.

// Export for testing
export function getRandomUrl(urls: string[] | undefined): string | undefined {
  if (!urls || urls.length === 0) {
    return undefined;
  }
  const randomIndex = Math.floor(Math.random() * urls.length);
  return urls[randomIndex];
}

export class ProxyController {
  public async checkProxyHealth(req: Request, res: Response): Promise<void> {
    const chainName = req.params.chain?.toLowerCase();
    if (!chainName) {
      res.status(400).json({ error: "Chain parameter is missing." });
      return;
    }

    const chainConfig = config.getChainConfig(chainName);

    if (!chainConfig) {
      res
        .status(404)
        .json({ error: `Configuration for chain '${chainName}' not found.` });
      return;
    }

    // Use updated types for executionRpcUrl and consensusApiUrl (string[] | undefined)
    const {
      executionRpcUrl: executionRpcUrls,
      consensusApiUrl: consensusApiUrls,
    } = chainConfig;

    if (
      (!executionRpcUrls || executionRpcUrls.length === 0) &&
      (!consensusApiUrls || consensusApiUrls.length === 0)
    ) {
      res.status(404).json({
        error: `No RPC/API URLs configured for chain '${chainName}'.`,
      });
      return;
    }

    const healthChecks: any = {}; // Use 'any' for flexibility or define a stricter type

    // Check execution layer
    const selectedExecutionUrl = getRandomUrl(executionRpcUrls);
    if (selectedExecutionUrl) {
      healthChecks.execution = {
        url: selectedExecutionUrl,
        status: "unhealthy",
      };
      try {
        const response = await fetch(selectedExecutionUrl, {
          // Use selected URL
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1,
          }),
        });
        healthChecks.execution.status = response.ok ? "healthy" : "unhealthy";
      } catch (error) {
        healthChecks.execution.status = "unhealthy";
        console.error(
          `Health check failed for ${chainName} execution on ${selectedExecutionUrl}: ${error}`
        );
      }
    } else {
      healthChecks.execution = { url: null, status: "not_configured" };
    }

    // Check consensus layer
    const selectedConsensusUrl = getRandomUrl(consensusApiUrls);
    if (selectedConsensusUrl) {
      healthChecks.consensus = {
        url: selectedConsensusUrl,
        status: "unhealthy",
      };
      try {
        const response = await fetch(
          `${selectedConsensusUrl}/eth/v1/node/health`
        ); // Add timeout & use selected URL
        healthChecks.consensus.status = response.ok ? "healthy" : "unhealthy";
      } catch (error) {
        healthChecks.consensus.status = "unhealthy";
        console.error(
          `Health check failed for ${chainName} consensus on ${selectedConsensusUrl}: ${error}`
        );
      }
    } else {
      healthChecks.consensus = { url: null, status: "not_configured" };
    }

    const allHealthy = Object.values(healthChecks).every(
      (check: any) =>
        check.status === "healthy" || check.status === "not_configured"
    );
    const anyUnhealthy = Object.values(healthChecks).some(
      (check: any) => check.status === "unhealthy"
    );

    let overallStatus = "healthy";
    if (anyUnhealthy) {
      overallStatus = "unhealthy";
    } else if (
      !allHealthy &&
      !Object.values(healthChecks).some(
        (check: any) => check.status === "healthy"
      )
    ) {
      // This case means everything is 'not_configured'
      overallStatus = "not_configured";
    }

    res.status(anyUnhealthy ? 503 : 200).json({
      status: overallStatus,
      chain: chainName,
      checks: healthChecks,
      timestamp: new Date().toISOString(),
    });
  }
}
