import { describe, expect, it } from 'vitest';
import { resolveApiCorrelationId } from './correlation';
import type { ProblemDetails } from './types';

function headersFrom(map: Record<string, string>): { get(name: string): string | null } {
  const lower = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    get(name: string) {
      return lower[name.toLowerCase()] ?? null;
    },
  };
}

describe('resolveApiCorrelationId', () => {
  it('prefers X-Correlation-ID over X-Request-Id', () => {
    const h = headersFrom({
      'X-Correlation-ID': 'corr-1',
      'X-Request-Id': 'req-9',
    });
    expect(resolveApiCorrelationId(h)).toBe('corr-1');
  });

  it('falls back to X-Request-Id', () => {
    const h = headersFrom({ 'X-Request-Id': 'abc-123' });
    expect(resolveApiCorrelationId(h)).toBe('abc-123');
  });

  it('falls back to Request-Id', () => {
    const h = headersFrom({ 'Request-Id': 'rid' });
    expect(resolveApiCorrelationId(h)).toBe('rid');
  });

  it('uses problem correlationId when headers are absent', () => {
    const problem: ProblemDetails = {
      title: 'Error',
      status: 400,
      correlationId: 'body-ref',
    };
    expect(resolveApiCorrelationId(headersFrom({}), problem)).toBe('body-ref');
  });

  it('prefers headers over problem body', () => {
    const problem: ProblemDetails = {
      title: 'Error',
      status: 400,
      correlationId: 'body-ref',
    };
    const h = headersFrom({ 'X-Correlation-ID': 'hdr-ref' });
    expect(resolveApiCorrelationId(h, problem)).toBe('hdr-ref');
  });

  it('returns null when nothing is present', () => {
    expect(resolveApiCorrelationId(headersFrom({}))).toBeNull();
    expect(
      resolveApiCorrelationId(headersFrom({}), { title: 'x', status: 400 })
    ).toBeNull();
  });
});
