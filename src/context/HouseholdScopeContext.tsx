import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiError, listHouseholds, type ListHouseholdsResult, type RecipeScope } from '../api/client';
import type { HouseholdSummary } from '../api/types';
import { loadPersistedHouseholdId, persistHouseholdId } from '../lib/householdScopeStorage';

export type HouseholdScopeContextValue = {
  households: HouseholdSummary[];
  /** Null = personal library */
  activeHouseholdId: string | null;
  activeLabel: string;
  recipeScope: RecipeScope;
  householdsLoading: boolean;
  householdsError: string | null;
  householdsEndpointAvailable: boolean;
  setActiveHouseholdId: (id: string | null) => Promise<void>;
  refreshHouseholds: () => Promise<void>;
};

const HouseholdScopeContext = createContext<HouseholdScopeContextValue | null>(null);

export function HouseholdScopeProvider({ children }: { children: React.ReactNode }) {
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [activeHouseholdId, setActiveHouseholdIdState] = useState<string | null>(null);
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [householdsError, setHouseholdsError] = useState<string | null>(null);
  const [householdsEndpointAvailable, setHouseholdsEndpointAvailable] = useState(false);

  const applyListResult = useCallback((result: ListHouseholdsResult, preferredId: string | null) => {
    setHouseholds(result.items);
    setHouseholdsEndpointAvailable(result.endpointAvailable);
    let next = preferredId;
    if (result.endpointAvailable && preferredId && !result.items.some((h) => h.id === preferredId)) {
      next = null;
      void persistHouseholdId(null);
    }
    setActiveHouseholdIdState(next);
  }, []);

  const refreshHouseholds = useCallback(async () => {
    setHouseholdsLoading(true);
    setHouseholdsError(null);
    try {
      const result = await listHouseholds();
      const stored = await loadPersistedHouseholdId();
      applyListResult(result, stored);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to load households';
      setHouseholdsError(msg);
    } finally {
      setHouseholdsLoading(false);
    }
  }, [applyListResult]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setHouseholdsLoading(true);
      setHouseholdsError(null);
      const stored = await loadPersistedHouseholdId();
      if (cancelled) return;
      setActiveHouseholdIdState(stored);
      try {
        const result = await listHouseholds();
        if (cancelled) return;
        applyListResult(result, stored);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to load households';
        setHouseholdsError(msg);
        setActiveHouseholdIdState(stored);
      } finally {
        if (!cancelled) setHouseholdsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyListResult]);

  const setActiveHouseholdId = useCallback(async (id: string | null) => {
    setActiveHouseholdIdState(id);
    await persistHouseholdId(id);
  }, []);

  const activeLabel = useMemo(() => {
    if (activeHouseholdId == null) return 'Personal';
    const h = households.find((x) => x.id === activeHouseholdId);
    return h?.name ?? 'Household';
  }, [activeHouseholdId, households]);

  const recipeScope = useMemo(
    (): RecipeScope => (activeHouseholdId ? { householdId: activeHouseholdId } : {}),
    [activeHouseholdId]
  );

  const value = useMemo(
    (): HouseholdScopeContextValue => ({
      households,
      activeHouseholdId,
      activeLabel,
      recipeScope,
      householdsLoading,
      householdsError,
      householdsEndpointAvailable,
      setActiveHouseholdId,
      refreshHouseholds,
    }),
    [
      households,
      activeHouseholdId,
      activeLabel,
      recipeScope,
      householdsLoading,
      householdsError,
      householdsEndpointAvailable,
      setActiveHouseholdId,
      refreshHouseholds,
    ]
  );

  return (
    <HouseholdScopeContext.Provider value={value}>{children}</HouseholdScopeContext.Provider>
  );
}

export function useHouseholdScope(): HouseholdScopeContextValue {
  const ctx = useContext(HouseholdScopeContext);
  if (!ctx) {
    throw new Error('useHouseholdScope must be used within HouseholdScopeProvider');
  }
  return ctx;
}
