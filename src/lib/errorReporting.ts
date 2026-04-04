/**
 * Optional integration point for crash or analytics SDKs.
 * No vendor-specific code — call from the API client on terminal failures if desired.
 * Context may include `correlationId` from API responses (headers or problem+json).
 */
export function reportClientError(
  _error: unknown,
  _context: Record<string, string | number | boolean | null | undefined>
): void {
  // Intentionally no-op in the template; wire your provider here.
}
