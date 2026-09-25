import { type HealthResponse, HealthResponseSchema } from "@finifeed/shared";

/** Returns null if the backend is unreachable or answers with something unexpected. */
export async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch("/api/v1/health");
    const parsed = HealthResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
