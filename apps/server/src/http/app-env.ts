import type { Logger } from "pino";
import type { RequestIdVariables } from "hono/request-id";

/** Hono context typing shared by all routes. */
export interface AppEnv {
  Variables: RequestIdVariables & {
    /** Logger bound to the current request ID. */
    logger: Logger;
    /** The acting user. Set by the auth middleware. */
    userId: string;
  };
}
