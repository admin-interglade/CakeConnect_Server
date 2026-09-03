import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config/index.js";
import { apiRateLimiter } from "./common/middleware/rateLimiter.js";
import { notFound, errorHandler } from "./common/middleware/errorHandler.js";
import { setupRoutes } from "./routes/index.js";
import { setupSwagger } from "./swagger.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
  app.use(express.json({ limit: "10mb" }));
  app.use(apiRateLimiter);

  app.get("/health", (_req, res) => {
    res.json({ success: true, message: "CakeConnect API is healthy" });
  });

  setupSwagger(app);

  setupRoutes(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
