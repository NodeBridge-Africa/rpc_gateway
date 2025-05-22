import prom from "prom-client";
import { Request, Response, NextFunction } from "express";
import axios from "axios";

const prometheus = process.env.PROMETHEUS_URL;
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

// Enhanced Ethereum node metrics
export const nodeExecutionSyncing = new prom.Gauge({
  name: "ethereum_execution_syncing",
  help: "Whether the execution layer is syncing (1) or not (0)",
});

export const nodeConsensusSyncing = new prom.Gauge({
  name: "ethereum_consensus_syncing",
  help: "Whether the consensus layer is syncing (1) or not (0)",
});

export const nodeConsensusHeadSlot = new prom.Gauge({
  name: "ethereum_consensus_head_slot",
  help: "Current head slot of the consensus layer",
});

export const nodeHealthStatus = new prom.Gauge({
  name: "ethereum_node_health_status",
  help: "Overall node health status (1=healthy, 0.5=degraded, 0=unhealthy)",
});

export const nodePrometheusMetricsAvailable = new prom.Gauge({
  name: "ethereum_prometheus_metrics_available",
  help: "Whether Prometheus metrics are available (1) or not (0)",
});

export const nodeRuntimeGcCycles = new prom.Gauge({
  name: "ethereum_node_gc_cycles_total",
  help: "Total GC cycles from the Ethereum node",
});

export const nodeRuntimeHeapAllocs = new prom.Gauge({
  name: "ethereum_node_heap_allocs_bytes",
  help: "Total heap allocations from the Ethereum node",
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

// Function to update Ethereum node metrics
export const updateEthereumNodeMetrics = async () => {
  try {
    // Get node health data
    const checks = await Promise.allSettled([
      // Check execution layer
      axios.post(
        `${process.env.EXECUTION_RPC_URL}/`,
        {
          jsonrpc: "2.0",
          method: "eth_syncing",
          params: [],
          id: 1,
        },
        { timeout: 5000 }
      ),

      // Check consensus layer
      axios.get(`${process.env.CONSENSUS_API_URL}/eth/v1/node/syncing`, {
        timeout: 5000,
      }),

      // Get Prometheus metrics
      axios.get(`${prometheus}/metrics`, { timeout: 10000 }),
    ]);

    const [execResult, consensusResult, prometheusResult] = checks;

    // Update execution layer metrics
    if (execResult.status === "fulfilled") {
      const syncStatus = execResult.value.data.result;
      nodeExecutionSyncing.set(syncStatus === false ? 0 : 1);
    }

    // Update consensus layer metrics
    if (consensusResult.status === "fulfilled") {
      const consensusData = consensusResult.value.data.data;
      nodeConsensusSyncing.set(consensusData.is_syncing ? 1 : 0);
      nodeConsensusHeadSlot.set(parseInt(consensusData.head_slot) || 0);
    }

    // Update Prometheus-derived metrics
    if (prometheusResult.status === "fulfilled") {
      nodePrometheusMetricsAvailable.set(1);

      const metricsText = prometheusResult.value.data;

      // Extract valuable metrics
      const gcCycles = extractMetricValue(
        metricsText,
        "go_gc_cycles_total_gc_cycles_total"
      );
      const heapAllocs = extractMetricValue(
        metricsText,
        "go_gc_heap_allocs_bytes_total"
      );

      if (gcCycles !== null) nodeRuntimeGcCycles.set(gcCycles);
      if (heapAllocs !== null) nodeRuntimeHeapAllocs.set(heapAllocs);
    } else {
      nodePrometheusMetricsAvailable.set(0);
    }

    // Calculate overall health status
    const healthyServices = [
      execResult.status === "fulfilled" ? 1 : 0,
      consensusResult.status === "fulfilled" ? 1 : 0,
    ];

    const totalHealthy = healthyServices.reduce(
      (sum, status) => sum + status,
      0
    );
    const healthRatio = totalHealthy / healthyServices.length;

    if (healthRatio === 1) {
      nodeHealthStatus.set(1); // healthy
    } else if (healthRatio >= 0.5) {
      nodeHealthStatus.set(0.5); // degraded
    } else {
      nodeHealthStatus.set(0); // unhealthy
    }
  } catch (error) {
    console.error("Error updating Ethereum node metrics:", error);
    nodeHealthStatus.set(0);
    nodePrometheusMetricsAvailable.set(0);
  }
};

// Helper function to extract metric values from Prometheus format
function extractMetricValue(
  metricsText: string,
  metricName: string
): number | null {
  // Look for lines that don't start with # (comments) and contain the metric name
  const lines = metricsText.split("\n");
  for (const line of lines) {
    if (!line.startsWith("#") && line.includes(metricName)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && parts[0] === metricName) {
        const value = parseFloat(parts[1]);
        return isNaN(value) ? null : value;
      }
    }
  }
  return null;
}

// Start periodic metrics collection
let metricsInterval: NodeJS.Timeout | null = null;

export const startMetricsCollection = () => {
  if (metricsInterval) return; // Already started

  // Update immediately
  updateEthereumNodeMetrics();

  // Update every 30 seconds
  metricsInterval = setInterval(updateEthereumNodeMetrics, 30000);
  console.log("📊 Started Ethereum node metrics collection (30s interval)");
};

export const stopMetricsCollection = () => {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
    console.log("📊 Stopped Ethereum node metrics collection");
  }
};

// Initialize custom metrics with zero values to ensure they appear in output
const initializeCustomMetrics = () => {
  // Initialize HTTP metrics
  httpRequestsTotal.inc(
    {
      user_id: "init",
      api_key: "init",
      path: "/init",
      method: "GET",
      status_code: "200",
    },
    0
  );
  httpRequestDuration.observe(
    {
      user_id: "init",
      api_key: "init",
      path: "/init",
      method: "GET",
    },
    0
  );
  activeConnections.set(0);

  // Initialize RPC metrics
  rpcRequestsTotal.inc(
    {
      user_id: "init",
      api_key: "init",
      rpc_method: "init",
      endpoint_type: "execution",
    },
    0
  );

  rpcRequestDuration.observe(
    {
      user_id: "init",
      api_key: "init",
      rpc_method: "init",
      endpoint_type: "execution",
    },
    0
  );

  // Initialize rate limit metrics
  rateLimitHits.inc({ user_id: "init", api_key: "init" }, 0);
  userDailyRequests.set({ user_id: "init", api_key: "init" }, 0);
};

// Collect default metrics (CPU, memory, etc.)
prom.collectDefaultMetrics({
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Initialize custom metrics
initializeCustomMetrics();

// Export metrics endpoint handler
export const getMetrics = async (req: Request, res: Response) => {
  try {
    res.set("Content-Type", prom.register.contentType);

    // Force register our custom metrics with the current registry (important for tests)
    try {
      prom.register.registerMetric(httpRequestsTotal);
      prom.register.registerMetric(httpRequestDuration);
      prom.register.registerMetric(activeConnections);
      prom.register.registerMetric(rpcRequestsTotal);
      prom.register.registerMetric(rpcRequestDuration);
      prom.register.registerMetric(rateLimitHits);
      prom.register.registerMetric(userDailyRequests);
      prom.register.registerMetric(nodeExecutionSyncing);
      prom.register.registerMetric(nodeConsensusSyncing);
      prom.register.registerMetric(nodeConsensusHeadSlot);
      prom.register.registerMetric(nodeHealthStatus);
      prom.register.registerMetric(nodePrometheusMetricsAvailable);
      prom.register.registerMetric(nodeRuntimeGcCycles);
      prom.register.registerMetric(nodeRuntimeHeapAllocs);
    } catch (error: any) {
      // Metrics might already be registered, which is fine
      // This is expected behavior in test environments
    }

    // Always ensure default metrics are collected (important for tests)
    const existingMetrics = prom.register.getMetricsAsArray();
    const hasDefaultMetrics = existingMetrics.some(
      (metric) =>
        metric.name.includes("process_") || metric.name.includes("nodejs_")
    );

    if (!hasDefaultMetrics) {
      prom.collectDefaultMetrics({
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      });
    }

    const metrics = await prom.register.metrics();
    res.end(metrics);
  } catch (error) {
    console.error("Error generating metrics:", error);
    res.status(500).json({ error: "Failed to generate metrics" });
  }
};
