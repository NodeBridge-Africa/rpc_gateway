import { Router, Request, Response, NextFunction } from "express"; // Added Request, Response, NextFunction
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { apiKeyGuard } from "../middlewares/apiKey.middleware";
import { dynamicRateLimit } from "../middlewares/rateLimit.middleware";
import {
  recordRpcMetrics,
  recordRateLimitHit,
} from "../services/metrics.service";
import { ProxyController } from "../controllers/proxy.controller";
import { config } from "../config"; // Import config

const router = Router();
const proxyController = new ProxyController();

// Enhanced proxy middleware with RPC method tracking
const createRpcProxy = (
  targetUrl: string, // Changed from target
  chainName: string, // Added chainName
  endpointType: "execution" | "consensus"
) => {
  const pathRewriteRules: { [key: string]: string } = {};
  if (endpointType === "execution") {
    // Matches /<chainName>/exec/<apiKey>/<actual_path_to_node>
    // Rewrites to /<actual_path_to_node> for the target node
    pathRewriteRules[`^/${chainName}/exec/[^/]+`] = "";
  } else {
    // consensus
    pathRewriteRules[`^/${chainName}/cons/[^/]+`] = "";
  }

  return createProxyMiddleware({
    target: targetUrl, // Use targetUrl
    changeOrigin: true, // Usually true for this kind of setup
    timeout: 60000,
    proxyTimeout: 60000,
    pathRewrite: pathRewriteRules,
    onProxyReq: (proxyReq, req: any) => {
      // Fix request body first
      fixRequestBody(proxyReq, req);

      const startTime = Date.now();
      req.startTime = startTime;

      // Log the request
      console.log(
        `[${chainName.toUpperCase()}-${endpointType.toUpperCase()}] ${
          req.method
        } ${req.url} - User: ${
          // Added chainName to log
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
          `${chainName}-${endpointType}`, // Added chainName to metrics
          duration
        );
      }

      // Add custom headers
      res.setHeader("X-RPC-Gateway", "NodeBridge");
      res.setHeader("X-Endpoint-Type", `${chainName}-${endpointType}`); // Added chainName
      res.setHeader("X-Response-Time", `${duration}s`);

      console.log(
        `[${chainName.toUpperCase()}-${endpointType.toUpperCase()}] Response: ${
          // Added chainName to log
          proxyRes.statusCode
        } - ${duration}s`
      );
    },
    onError: (err, req: any, res) => {
      console.error(
        `[${chainName.toUpperCase()}-${endpointType.toUpperCase()}] Proxy Error:`, // Added chainName to log
        err.message
      );
      res.status(502).json({
        error: "Bad Gateway",
        message: `Failed to connect to the ${chainName} ${endpointType} node`, // Added chainName
        endpointType: `${chainName}-${endpointType}`, // Added chainName
      });
    },
  });
};

// Enhanced rate limiting with metrics
const rateLimitWithMetrics = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Typed req, res, next
  const originalSend = res.status;
  res.status = function (statusCode: number) {
    if (statusCode === 429 && (req as any).user && (req as any).apiKey) {
      // Type assertion for req.user/req.apiKey
      recordRateLimitHit((req as any).user._id.toString(), (req as any).apiKey);
    }
    return originalSend.call(this, statusCode);
  };

  return dynamicRateLimit(req, res, next);
};

// Execution layer proxy routes (JSON-RPC)
// /:chain/exec/<API_KEY>/...
router.use(
  "/:chain/exec/:key",
  apiKeyGuard,
  rateLimitWithMetrics,
  (req: Request, res: Response, next: NextFunction) => {
    const chainName = req.params.chain.toLowerCase();
    const chainConfig = config.getChainConfig(chainName);

    if (!chainConfig?.executionRpcUrl) {
      return res
        .status(404)
        .json({
          error: `Execution RPC URL not configured for chain ${chainName}`,
        });
    }
    const executionProxyInstance = createRpcProxy(
      chainConfig.executionRpcUrl,
      chainName,
      "execution"
    );
    executionProxyInstance(req, res, next);
  }
);

// Consensus layer proxy routes (REST API)
// /:chain/cons/<API_KEY>/...
router.use(
  "/:chain/cons/:key",
  apiKeyGuard,
  rateLimitWithMetrics,
  (req: Request, res: Response, next: NextFunction) => {
    const chainName = req.params.chain.toLowerCase();
    const chainConfig = config.getChainConfig(chainName);

    if (!chainConfig?.consensusApiUrl) {
      return res
        .status(404)
        .json({
          error: `Consensus API URL not configured for chain ${chainName}`,
        });
    }
    const consensusProxyInstance = createRpcProxy(
      chainConfig.consensusApiUrl,
      chainName,
      "consensus"
    );
    consensusProxyInstance(req, res, next);
  }
);

// Health check endpoint for proxied services
router.get("/health/:chain", proxyController.checkProxyHealth); // Updated this line

export default router;
