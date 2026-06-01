import { householdScopeApiErrorMessage } from './householdScopeApiErrorMessage';

/** Maps library load/save failures to user-facing copy (household 401/403 + fallback). */
export function libraryErrorMessage(
  e: unknown,
  fallback: string,
  mode: 'read' | 'write' = 'write'
): string {
  const scope = householdScopeApiErrorMessage(e, mode === 'read' ? 'library-read' : 'library');
  if (scope) return scope;
  return e instanceof Error ? e.message : fallback;
}
