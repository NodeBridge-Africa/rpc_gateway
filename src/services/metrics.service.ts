import prom from "prom-client";
import { Request, Response, NextFunction } from "express";

// Create metrics
export const httpRequestsTotal = new prom.Counter({
  name: "rpc_gateway_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["user_id", "api_key", "path", "method", "status_code"],
});

export const httpRequestDuration = new prom.Histogram({
  name: "rpc_gateway_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["user_id", "api_key", "path", "method"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

export const activeConnections = new prom.Gauge({
  name: "rpc_gateway_active_connections",
  help: "Number of active connections",
});

export const rpcRequestsTotal = new prom.Counter({
  name: "rpc_requests_total",
  help: "Total number of RPC requests",
  labelNames: ["user_id", "api_key", "rpc_method", "endpoint_type"], // endpoint_type: execution/consensus
});

export const rpcRequestDuration = new prom.Histogram({
  name: "rpc_request_duration_seconds",
  help: "RPC request latency in seconds",
  labelNames: ["user_id", "api_key", "rpc_method", "endpoint_type"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
});

export const rateLimitHits = new prom.Counter({
  name: "rpc_gateway_rate_limit_hits_total",
  help: "Total number of rate limit hits",
  labelNames: ["user_id", "api_key"],
});

export const userDailyRequests = new prom.Gauge({
  name: "rpc_gateway_user_daily_requests",
  help: "Number of requests made by user today",
  labelNames: ["user_id", "api_key"],
});

// Middleware to collect HTTP metrics
export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  // Increment active connections
  activeConnections.inc();

  // Extract user info if available
  const user = (req as any).user;
  const apiKey = (req as any).apiKey || "unknown";
  const userId = user?._id?.toString() || "anonymous";

  res.on("finish", () => {
    const duration = (Date.now() - startTime) / 1000;

    // Record HTTP metrics
    httpRequestsTotal.inc({
      user_id: userId,
      api_key: apiKey,
      path: req.path,
      method: req.method,
      status_code: res.statusCode.toString(),
    });

    httpRequestDuration.observe(
      {
        user_id: userId,
        api_key: apiKey,
        path: req.path,
        method: req.method,
      },
      duration
    );

    // Update daily requests gauge if user exists
    if (user?.dailyRequests) {
      userDailyRequests.set(
        {
          user_id: userId,
          api_key: apiKey,
        },
        user.dailyRequests
      );
    }

    // Decrement active connections
    activeConnections.dec();
  });

  next();
};

// Function to record RPC-specific metrics
export const recordRpcMetrics = (
  userId: string,
  apiKey: string,
  rpcMethod: string,
  endpointType: "execution" | "consensus",
  duration: number
) => {
  rpcRequestsTotal.inc({
    user_id: userId,
    api_key: apiKey,
    rpc_method: rpcMethod,
    endpoint_type: endpointType,
  });

  rpcRequestDuration.observe(
    {
      user_id: userId,
      api_key: apiKey,
      rpc_method: rpcMethod,
      endpoint_type: endpointType,
    },
    duration
  );
};

// Function to record rate limit hits
export const recordRateLimitHit = (userId: string, apiKey: string) => {
  rateLimitHits.inc({
    user_id: userId,
    api_key: apiKey,
  });
};

// Collect default metrics (CPU, memory, etc.)
prom.collectDefaultMetrics({
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Export metrics endpoint handler
export const getMetrics = async (req: Request, res: Response) => {
  try {
    res.set("Content-Type", prom.register.contentType);
    const metrics = await prom.register.metrics();
    res.end(metrics);
  } catch (error) {
    console.error("Error generating metrics:", error);
    res.status(500).json({ error: "Failed to generate metrics" });
  }
};
