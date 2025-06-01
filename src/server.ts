import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import database from "./config/database";
import authRoutes from "./routes/auth.routes";
import proxyRoutes from "./routes/proxy.routes";
import adminRoutes from "./routes/admin.routes";
import appRoutes from "./routes/app.routes";
import {
  metricsMiddleware,
  getMetrics,
  startMetricsCollection,
  stopMetricsCollection,
} from "./services/metrics.service";

async function startServer() {
  try {
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
            ? [process.env.FRONTEND_URL || "*"]
            : ["*"],
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
        description: "Multi-tenant RPC gateway for node access",
        endpoints: {
          apiInfo: "GET /",
          healthCheck: "GET /health",
          metrics: "GET /metrics",
          auth: {
            register: "POST /auth/register",
            login: "POST /auth/login",
            account: "GET /auth/account",
            me: "GET /auth/me",
            updatePassword: "PATCH /auth/password",
            updateEmail: "PATCH /auth/email",
            exportData: "GET /auth/export",
          },
          rpcProxy: {
            execution: "ALL /:chain/exec/:apiKey/*",
            consensus: "ALL /:chain/cons/:apiKey/*",
            health: "GET /health/:chain",
          },
          apps: {
            create: "POST /apps",
            list: "GET /apps",
            dashboardStats: "GET /apps/dashboard/stats",
            allAppsUsage: "GET /apps/usage/all",
            getApp: "GET /apps/:appId",
            updateApp: "PATCH /apps/:appId",
            deleteApp: "DELETE /apps/:appId",
            regenerateApiKey: "POST /apps/:appId/regenerate-key",
            appUsage: "GET /apps/:appId/usage",
          },
          admin: {
            nodeHealth: "GET /admin/node-health/:chain",
            nodeMetrics: "GET /admin/node-metrics/:chain",
            addChain: "POST /admin/chains",
            listChains: "GET /admin/chains",
            updateChain: "PATCH /admin/chains/:chainIdToUpdate",
            deleteChain: "DELETE /admin/chains/:chainIdToDelete",
            updateApp: "PATCH /admin/apps/:appId",
            updateUser: "PATCH /admin/users/:userId",
            get: "GET /admin/default-app-settings",
            update: "PATCH /admin/default-app-settings",
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
    app.use("/", proxyRoutes); // Proxy routes handle /:chain/exec and /:chain/cons
    app.use("/apps", appRoutes);

    // Metrics endpoint for Prometheus
    app.get("/metrics", getMetrics);

    // 404 handler
    app.use("*", (req, res) => {
      res.status(404).json({
        error: "Endpoint not found",
        message: `The endpoint ${req.method} ${req.originalUrl} was not found`,
        availableEndpoints: [
          "GET /",
          "GET /health",
          "GET /metrics",
          "POST /auth/register",
          "POST /auth/login",
          "GET /auth/account",
          "GET /auth/me",
          "PATCH /auth/password",
          "PATCH /auth/email",
          "GET /auth/export",
          "ALL /:chain/exec/:apiKey/*",
          "ALL /:chain/cons/:apiKey/*",
          "GET /health/:chain",
          "POST /apps",
          "GET /apps",
          "GET /apps/dashboard/stats",
          "GET /apps/usage/all",
          "GET /apps/:appId",
          "PATCH /apps/:appId",
          "DELETE /apps/:appId",
          "POST /apps/:appId/regenerate-key",
          "GET /apps/:appId/usage",
          "GET /admin/node-health/:chain",
          "GET /admin/node-metrics/:chain",
          "POST /admin/chains",
          "GET /admin/chains",
          "PATCH /admin/chains/:chainIdToUpdate",
          "DELETE /admin/chains/:chainIdToDelete",
          "PATCH /admin/apps/:appId",
          "PATCH /admin/users/:userId",
          "GET /admin/default-app-settings",
          "PATCH /admin/default-app-settings",
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
    const PORT = Number(process.env.PORT) || 8888;
    const server = app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
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
