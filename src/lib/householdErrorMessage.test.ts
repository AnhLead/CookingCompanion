import { describe, expect, it } from 'vitest';
import { householdErrorMessage } from './householdErrorMessage';

describe('householdErrorMessage', () => {
  it('maps create 401 to sign-in guidance', () => {
    const message = householdErrorMessage(
      { status: 401, message: 'Unauthorized' },
      'create',
      'Create failed'
    );
    expect(message).toMatch(/sign in/i);
    expect(message).toMatch(/create/i);
    expect(message).not.toMatch(/\(401\)/);
  });

  it('maps create 403 to permission guidance', () => {
    const message = householdErrorMessage(
      { status: 403, message: 'Forbidden' },
      'create',
      'Create failed'
    );
    expect(message).toMatch(/permission/i);
    expect(message).not.toMatch(/\(403\)/);
  });

  it('maps list 401 to sign-in guidance', () => {
    const message = householdErrorMessage(
      { status: 401, message: 'Unauthorized' },
      'list',
      'Failed to load households'
    );
    expect(message).toMatch(/sign in/i);
    expect(message).toMatch(/households/i);
    expect(message).not.toMatch(/\(401\)/);
  });

  it('maps list 403 to permission guidance', () => {
    const message = householdErrorMessage(
      { status: 403, message: 'Forbidden' },
      'list',
      'Failed to load households'
    );
    expect(message).toMatch(/permission/i);
    expect(message).not.toMatch(/\(403\)/);
  });

  it('maps join 401 to sign-in guidance', () => {
    expect(householdErrorMessage({ status: 401, message: 'Unauthorized' }, 'join', 'Join failed')).toBe(
      'Sign in to join a household.'
    );
  });

  it('maps join 404 to invalid code guidance', () => {
    expect(
      householdErrorMessage({ status: 404, message: 'Invalid invite code' }, 'join', 'Join failed')
    ).toBe('That invite code is not valid. Check with your household owner.');
  });

  it('falls back to Error message for other API failures', () => {
    expect(householdErrorMessage(new Error('Server error'), 'create', 'Create failed')).toBe('Server error');
  });

  it('uses fallback for non-Error values', () => {
    expect(householdErrorMessage(null, 'list', 'Failed to load households')).toBe('Failed to load households');
  });
});
