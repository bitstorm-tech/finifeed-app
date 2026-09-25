import { loadConfig } from "../config/config";
import { createLogger } from "../http/logger";
import { connectDatabase } from "./database";
import { migrate } from "./migrate";

const config = loadConfig();
const logger = createLogger(config);
const database = connectDatabase(config.databaseUrl);

try {
  await migrate(database.sql, logger);
} catch (error) {
  logger.fatal({ err: error }, "migration failed");
  process.exitCode = 1;
} finally {
  await database.close();
}
