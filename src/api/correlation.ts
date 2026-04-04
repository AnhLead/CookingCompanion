import type { ProblemDetails } from './types';

const CORRELATION_HEADER_NAMES = ['x-correlation-id', 'x-request-id', 'request-id'] as const;

/**
 * Resolves a support reference from response headers and optional RFC 7807 problem body.
 */
export function resolveApiCorrelationId(
  headers: { get(name: string): string | null },
  problem?: ProblemDetails | null
): string | null {
  for (const name of CORRELATION_HEADER_NAMES) {
    const v = headers.get(name)?.trim();
    if (v) return v;
  }
  const fromBody = problem?.correlationId?.trim();
  if (fromBody) return fromBody;
  return null;
}
