/**
 * Logs the real database/API error server-side and returns a safe message
 * for the client. Raw Postgres messages can expose table names, constraint
 * names and column values, so they never leave the server.
 */
export function apiErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan pada server.",
): string {
  console.error("[api]", error);
  return fallback;
}
