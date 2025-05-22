import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { validateEnv } from "./config/env.example";
import database from "./config/database";
import authRoutes from "./routes/auth.routes";
import proxyRoutes from "./routes/proxy.routes";
import adminRoutes from "./routes/admin.routes";
import {
  metricsMiddleware,
  getMetrics,
  startMetricsCollection,
  stopMetricsCollection,
} from "./services/metrics.service";

async function startServer() {
  try {
    // Validate environment variables
    validateEnv();

    // Connect to database
    await database.connect();

    // Create Express app
    const app = express();

    // Security middleware
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );

    // CORS configuration
    app.use(
      cors({
        origin:
          process.env.NODE_ENV === "production"
            ? [process.env.FRONTEND_URL || "https://yourdomain.com"]
            : ["http://localhost:3000", "http://127.0.0.1:3000"],
        credentials: true,
      })
    );

    // Body parsing middleware
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Metrics middleware (applied to all routes)
    app.use(metricsMiddleware);

    // API Documentation route
    app.get("/", (req, res) => {
      res.json({
        name: "NodeBridge RPC Gateway",
        version: "1.0.0",
        description: "Multi-tenant RPC gateway for Sepolia node access",
        endpoints: {
          auth: {
            register: "POST /auth/register",
            login: "POST /auth/login",
            account: "GET /auth/account",
            usage: "GET /auth/usage",
            regenerateApiKey: "POST /auth/regenerate-api-key",
          },
          rpc: {
            execution: "ALL /exec/<API_KEY>/*",
            consensus: "ALL /cons/<API_KEY>/*",
          },
          monitoring: {
            health: "GET /health",
            metrics: "GET /metrics",
            nodeHealth: "GET /admin/node-health",
            nodeMetrics: "GET /admin/node-metrics",
          },
        },
        documentation: "https://github.com/your-repo/nodebridge-rpc-gateway",
      });
    });

    // Health check endpoint
    app.get("/health", async (req, res) => {
      try {
        const dbHealth = await database.healthCheck();

        res.json({
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          services: {
            database: dbHealth,
            memory: {
              used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            },
            uptime: process.uptime(),
          },
        });
      } catch (error) {
        res.status(503).json({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: "Health check failed",
        });
      }
    });

    // Routes
    app.use("/auth", authRoutes);
    app.use("/admin", adminRoutes);
    app.use("/", proxyRoutes); // Proxy routes handle /exec and /cons

    // Metrics endpoint for Prometheus
    app.get("/metrics", getMetrics);

    // 404 handler
    app.use("*", (req, res) => {
      res.status(404).json({
        error: "Endpoint not found",
        message: `The endpoint ${req.method} ${req.originalUrl} was not found`,
        availableEndpoints: [
          "POST /auth/register",
          "POST /auth/login",
          "GET /auth/account",
          "ALL /exec/<API_KEY>/*",
          "ALL /cons/<API_KEY>/*",
          "GET /health",
          "GET /metrics",
        ],
      });
    });

    // Global error handler
    app.use((error: any, req: any, res: any, next: any) => {
      console.error("Global error handler:", error);

      res.status(error.status || 500).json({
        error: "Internal Server Error",
        message:
          process.env.NODE_ENV === "production"
            ? "Something went wrong"
            : error.message,
        timestamp: new Date().toISOString(),
      });
    });

    // Start server
    const PORT = process.env.PORT || 8888;
    const server = app.listen(PORT, () => {
      console.log(`🚀 NodeBridge RPC Gateway running on port ${PORT}`);
      console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
      console.log(`💚 Health check at http://localhost:${PORT}/health`);
      console.log(`📖 API docs at http://localhost:${PORT}/`);

      // Start Ethereum node metrics collection
      startMetricsCollection();
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        console.log("HTTP server closed");

        try {
          // Stop metrics collection
          stopMetricsCollection();

          await database.disconnect();
          console.log("Database connection closed");
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  console.error("Unhandled error during server startup:", error);
  process.exit(1);
});
