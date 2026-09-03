import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./common/logger.js";
import { initJobs } from "./jobs/index.js";

async function bootstrap() {
  const app = createApp();

  try {
    await initJobs();
  } catch (err) {
    logger.warn(`Background jobs not initialized: ${(err as Error).message}`);
  }

  app.listen(config.port, () => {
    logger.info(`CakeConnect server running on port ${config.port}`);
    logger.info(`Docs available at /docs`);
  });
}

bootstrap().catch((err) => {
  logger.error(`Failed to start server: ${err}`);
  process.exit(1);
});
