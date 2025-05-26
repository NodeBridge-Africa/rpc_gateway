import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import appRoutes from './routes/app.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use('/apps', appRoutes);
app.use('/admin', adminRoutes);

app.get("/test", (_req: Request, res: Response) => {
  return res.sendStatus(200);
});

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
