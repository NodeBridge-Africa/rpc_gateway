import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "../../src/routes/auth.routes";
import proxyRoutes from "../../src/routes/proxy.routes";
import {
  metricsMiddleware,
  getMetrics,
} from "../../src/services/metrics.service";
import prom from "prom-client";

// Create test app without database connection
export function createTestApp() {
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
      origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
      credentials: true,
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Metrics middleware
  app.use(metricsMiddleware);

  // API Documentation route
  app.get("/", (req, res) => {
    res.json({
      name: "NodeBridge RPC Gateway - Test Mode",
      version: "1.0.0",
      description: "Multi-tenant RPC gateway for Sepolia node access",
      status: "testing",
    });
  });

  // Health check endpoint
  app.get("/health", async (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: "test",
    });
  });

  // Routes
  app.use("/auth", authRoutes);
  app.use("/", proxyRoutes);

  // Metrics endpoint
  app.get("/metrics", getMetrics);

  // Note: Default metrics are already collected by the metrics service

  // 404 handler
  app.use("*", (req, res) => {
    res.status(404).json({
      error: "Endpoint not found",
      message: `The endpoint ${req.method} ${req.originalUrl} was not found`,
    });
  });

  // Error handler
  app.use((error: any, req: any, res: any, next: any) => {
    res.status(error.status || 500).json({
      error: "Internal Server Error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
