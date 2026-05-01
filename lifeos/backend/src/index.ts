import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./core/logger";

app.listen(env.PORT, () => {
  logger.info(`LifeOS backend running on http://localhost:${env.PORT}`);
});
