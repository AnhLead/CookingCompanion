import { describe, expect, it } from 'vitest';
import { importErrorMessage } from './importErrorMessage';

describe('importErrorMessage', () => {
  it('maps duplicate source URL 409 with existingSourceId', () => {
    const result = importErrorMessage({
      status: 409,
      message: 'Conflict',
      problem: {
        title: 'Conflict',
        status: 409,
        detail: 'Source URL already imported (anonymous owner)',
        existingSourceId: 'src-uuid-123',
      },
    });
    expect(result.suggestRePreview).toBe(false);
    expect(result.message).toMatch(/already in your library/i);
  });

  it('maps preview already committed 409 with re-preview CTA', () => {
    const result = importErrorMessage({
      status: 409,
      message: 'Conflict',
      problem: {
        title: 'Conflict',
        status: 409,
        detail: 'preview already committed',
      },
    });
    expect(result.suggestRePreview).toBe(true);
    expect(result.message).toMatch(/already saved/i);
  });

  it('maps preview expired 410 with re-preview CTA', () => {
    const result = importErrorMessage({
      status: 410,
      message: 'Gone',
      problem: {
        title: 'Gone',
        status: 410,
        detail: 'preview expired',
      },
    });
    expect(result.suggestRePreview).toBe(true);
    expect(result.message).toMatch(/expired/i);
  });

  it('maps household scope 401 to sign-in guidance', () => {
    const result = importErrorMessage({
      status: 401,
      message: 'Unauthorized',
      problem: {
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required for household scope',
      },
    });
    expect(result.suggestRePreview).toBe(false);
    expect(result.message).toMatch(/sign in/i);
    expect(result.message).not.toMatch(/\(401\)/);
  });

  it('maps household membership 403 to scope picker guidance', () => {
    const result = importErrorMessage({
      status: 403,
      message: 'Forbidden',
      problem: {
        title: 'Forbidden',
        status: 403,
        detail: 'Not a member of this household',
      },
    });
    expect(result.suggestRePreview).toBe(false);
    expect(result.message).toMatch(/household/i);
    expect(result.message).toMatch(/library tab/i);
    expect(result.message).not.toMatch(/\(403\)/);
  });
});
