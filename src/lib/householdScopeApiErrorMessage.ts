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

const HOUSEHOLD_SCOPE_FORBIDDEN_MESSAGE =
  'You are not a member of the selected household. Open Household on the Library tab to switch scope, or choose Personal.';

function householdScopeUnauthorizedMessage(context: 'import' | 'library'): string {
  if (context === 'import') {
    return 'Sign in required to import into a household library. Open Sign in, then run Preview again.';
  }
  return 'Sign in required to save to a household library. Open Sign in, then try again.';
}

/** Maps household-scope 401/403 API failures to actionable copy; returns null when not applicable. */
export function householdScopeApiErrorMessage(
  e: unknown,
  context: 'import' | 'library'
): string | null {
  if (!isApiErrorLike(e)) return null;
  if (e.status === 401) return householdScopeUnauthorizedMessage(context);
  if (e.status === 403) return HOUSEHOLD_SCOPE_FORBIDDEN_MESSAGE;
  return null;
}
