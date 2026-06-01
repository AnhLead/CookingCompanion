import { householdScopeApiErrorMessage } from './householdScopeApiErrorMessage';

/** Maps library dish/variant CRUD failures to user-facing copy (household 401/403 + fallback). */
export function libraryErrorMessage(e: unknown, fallback: string): string {
  const scope = householdScopeApiErrorMessage(e, 'library');
  if (scope) return scope;
  return e instanceof Error ? e.message : fallback;
}
