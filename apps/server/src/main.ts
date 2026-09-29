import { createApp } from "./app";
import { ensureDevUser } from "./auth/dev-user";
import { loadConfig } from "./config/config";
import { connectDatabase } from "./database/database";
import { migrate } from "./database/migrate";
import { createLogger } from "./http/logger";
import { createYouTubeClient } from "./sources/youtube/youtube-client";
import { createYouTubeSourceAdapter } from "./sources/youtube/youtube-source-adapter";

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

if (!config.youtubeApiKey) {
  logger.warn("YOUTUBE_API_KEY is not set: adding YouTube creators will fail");
}

const youtube = createYouTubeSourceAdapter(createYouTubeClient({ apiKey: config.youtubeApiKey, logger }));
const devUserId = await ensureDevUser(database.db);
const app = createApp({ db: database.db, logger, sourceAdapters: { YOUTUBE: youtube }, devUserId });
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
