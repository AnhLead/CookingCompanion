import { describe, expect, it } from 'vitest';
import { libraryErrorMessage } from './libraryErrorMessage';

describe('libraryErrorMessage', () => {
  it('maps household scope 401 to sign-in guidance', () => {
    const message = libraryErrorMessage(
      {
        status: 401,
        message: 'Unauthorized',
      },
      'Could not save'
    );
    expect(message).toMatch(/sign in/i);
    expect(message).toMatch(/household library/i);
    expect(message).not.toMatch(/\(401\)/);
  });

  it('maps household membership 403 to scope picker guidance', () => {
    const message = libraryErrorMessage(
      {
        status: 403,
        message: 'Forbidden',
      },
      'Could not save'
    );
    expect(message).toMatch(/household/i);
    expect(message).toMatch(/library tab/i);
    expect(message).not.toMatch(/\(403\)/);
  });

  it('falls back to Error message for other API failures', () => {
    expect(libraryErrorMessage(new Error('Server error'), 'Could not save')).toBe('Server error');
  });

  it('uses fallback for non-Error values', () => {
    expect(libraryErrorMessage(null, 'Could not save')).toBe('Could not save');
  });

  it('maps household scope 401 on read paths to view guidance', () => {
    const message = libraryErrorMessage(
      {
        status: 401,
        message: 'Unauthorized',
      },
      'Failed to load',
      'read'
    );
    expect(message).toMatch(/sign in/i);
    expect(message).toMatch(/view a household library/i);
    expect(message).not.toMatch(/\(401\)/);
    expect(message).not.toMatch(/save to a household/i);
  });

  it('maps household membership 403 on read paths to scope picker guidance', () => {
    const message = libraryErrorMessage(
      {
        status: 403,
        message: 'Forbidden',
      },
      'Failed to load dish',
      'read'
    );
    expect(message).toMatch(/household/i);
    expect(message).toMatch(/library tab/i);
    expect(message).not.toMatch(/\(403\)/);
  });
});
