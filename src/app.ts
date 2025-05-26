import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import appRoutes from './routes/app.routes'; // Import app routes
import defaultAppSettingsRoutes from './routes/defaultAppSettings.routes'; // Import default app settings routes

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get("/test", (_req: Request, res: Response) => {
  return res.sendStatus(200);
});

// Mount the app routes
app.use('/api/v1/apps', appRoutes);

// Mount the default app settings routes (typically under an admin path)
app.use('/api/v1/admin/settings/app-defaults', defaultAppSettingsRoutes);

app.use("*", (req: Request, res: Response) => {
  const path = req.originalUrl;
  const method = req.method;
  return res.status(404).json({
    error: true,
    path,
    method,
    message: `The method ${method} is not defined on path ${path}`,
  });
});

export default app;
