import { createApp } from "./app";
import { loadConfig } from "./config/config";
import { connectDatabase } from "./database/database";
import { migrate } from "./database/migrate";
import { createLogger } from "./http/logger";

const config = loadConfig();
const logger = createLogger(config);
const database = connectDatabase(config.databaseUrl);

try {
  await migrate(database.sql, logger);
} catch (error) {
  logger.fatal({ err: error }, "startup failed: could not apply migrations");
  await database.close();
  process.exit(1);
}

const app = createApp({ db: database.db, logger });
const server = Bun.serve({ port: config.port, fetch: app.fetch });
logger.info({ port: server.port }, "server listening");

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  await server.stop();
  await database.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
