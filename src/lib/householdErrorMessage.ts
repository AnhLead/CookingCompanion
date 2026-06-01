type ApiErrorLike = {
  status: number;
  message: string;
};

function isApiErrorLike(e: unknown): e is ApiErrorLike {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as ApiErrorLike).status === 'number' &&
    typeof (e as ApiErrorLike).message === 'string'
  );
}

export type HouseholdErrorOperation = 'create' | 'join' | 'list';

function joinMessage(e: ApiErrorLike): string {
  if (e.status === 401) return 'Sign in to join a household.';
  if (e.status === 403) return 'You do not have permission to join this household.';
  if (e.status === 404) return 'That invite code is not valid. Check with your household owner.';
  return e.message;
}

/** Maps household create/join/list failures to user-facing copy (401/403 + fallback). */
export function householdErrorMessage(
  e: unknown,
  operation: HouseholdErrorOperation,
  fallback: string
): string {
  if (isApiErrorLike(e)) {
    if (operation === 'join') return joinMessage(e);
    if (e.status === 401) {
      if (operation === 'create') return 'Sign in to create a household.';
      return 'Sign in to view your households.';
    }
    if (e.status === 403) {
      if (operation === 'create') return 'You do not have permission to create a household.';
      return 'You do not have permission to view these households.';
    }
  }

  return e instanceof Error ? e.message : fallback;
}
