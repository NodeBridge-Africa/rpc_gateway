import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { apiKeyGuard } from "../middlewares/apiKey.middleware";
import { dynamicRateLimit } from "../middlewares/rateLimit.middleware";
import {
  recordRpcMetrics,
  recordRateLimitHit,
} from "../services/metrics.service";

const router = Router();

// Enhanced proxy middleware with RPC method tracking
const createRpcProxy = (
  target: string,
  endpointType: "execution" | "consensus"
) => {
  return createProxyMiddleware({
    target,
    changeOrigin: false,
    timeout: 60000,
    proxyTimeout: 60000,
    pathRewrite: {
      "^/exec/[^/]+": "", // Remove /exec/<api-key> from path
      "^/cons/[^/]+": "", // Remove /cons/<api-key> from path
    },
    onProxyReq: (proxyReq, req: any) => {
      // Fix request body first
      fixRequestBody(proxyReq, req);

      const startTime = Date.now();
      req.startTime = startTime;

      // Log the request
      console.log(
        `[${endpointType.toUpperCase()}] ${req.method} ${req.url} - User: ${
          req.user?.email || "unknown"
        }`
      );

      // Headers are automatically set by fixRequestBody middleware
    },
    onProxyRes: (proxyRes, req: any, res) => {
      const duration = (Date.now() - req.startTime) / 1000;
      const user = req.user;
      const apiKey = req.apiKey || "unknown";

      // Extract RPC method from request body if it's a JSON-RPC request
      let rpcMethod = "unknown";
      if (req.body && req.body.method) {
        rpcMethod = req.body.method;
      }

      // Record metrics
      if (user) {
        recordRpcMetrics(
          user._id.toString(),
          apiKey,
          rpcMethod,
          endpointType,
          duration
        );
      }

      // Add custom headers
      res.setHeader("X-RPC-Gateway", "NodeBridge");
      res.setHeader("X-Endpoint-Type", endpointType);
      res.setHeader("X-Response-Time", `${duration}s`);

      console.log(
        `[${endpointType.toUpperCase()}] Response: ${
          proxyRes.statusCode
        } - ${duration}s`
      );
    },
    onError: (err, req: any, res) => {
      console.error(
        `[${endpointType.toUpperCase()}] Proxy Error:`,
        err.message
      );
      res.status(502).json({
        error: "Bad Gateway",
        message: "Failed to connect to the Sepolia node",
        endpointType,
      });
    },
  });
};

// Enhanced rate limiting with metrics
const rateLimitWithMetrics = (req: any, res: any, next: any) => {
  const originalSend = res.status;
  res.status = function (statusCode: number) {
    if (statusCode === 429 && req.user && req.apiKey) {
      recordRateLimitHit(req.user._id.toString(), req.apiKey);
    }
    return originalSend.call(this, statusCode);
  };

  return dynamicRateLimit(req, res, next);
};

// Create proxy middlewares
const executionProxy = createRpcProxy(
  process.env.EXECUTION_RPC_URL || "http://192.168.8.229:8545",
  "execution"
);

const consensusProxy = createRpcProxy(
  process.env.CONSENSUS_API_URL || "http://192.168.8.229:5052",
  "consensus"
);

// Execution layer proxy routes (JSON-RPC)
// /exec/<API_KEY>/...
router.use("/exec/:key", apiKeyGuard, rateLimitWithMetrics, executionProxy);

// Consensus layer proxy routes (REST API)
// /cons/<API_KEY>/...
router.use("/cons/:key", apiKeyGuard, rateLimitWithMetrics, consensusProxy);

// Health check endpoint for proxied services
router.get("/health", async (req, res) => {
  const executionUrl =
    process.env.EXECUTION_RPC_URL || "http://192.168.8.229:8545";
  const consensusUrl =
    process.env.CONSENSUS_API_URL || "http://192.168.8.229:5052";

  const healthChecks = {
    execution: { url: executionUrl, status: "unknown" },
    consensus: { url: consensusUrl, status: "unknown" },
  };

  // Simple health check for execution layer (JSON-RPC)
  try {
    const response = await fetch(executionUrl, {
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
  }

  // Simple health check for consensus layer (REST API)
  try {
    const response = await fetch(`${consensusUrl}/eth/v1/node/health`);
    healthChecks.consensus.status = response.ok ? "healthy" : "unhealthy";
  } catch (error) {
    healthChecks.consensus.status = "unhealthy";
  }

  const allHealthy = Object.values(healthChecks).every(
    (check) => check.status === "healthy"
  );

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "unhealthy",
    checks: healthChecks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
