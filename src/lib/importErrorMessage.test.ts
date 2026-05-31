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
});
