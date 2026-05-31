export type ImportErrorPresentation = {
  message: string;
  /** When true, UI should offer a primary Re-run preview action. */
  suggestRePreview: boolean;
};

type ImportApiErrorLike = {
  status: number;
  message: string;
  problem?: { detail?: string } & Record<string, unknown>;
};

function isImportApiError(e: unknown): e is ImportApiErrorLike {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as ImportApiErrorLike).status === 'number' &&
    typeof (e as ImportApiErrorLike).message === 'string'
  );
}

function existingSourceIdFrom(e: ImportApiErrorLike): string | undefined {
  const id = e.problem?.existingSourceId;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

/** Maps import preview/commit API failures to actionable copy for the import screen. */
export function importErrorMessage(e: unknown): ImportErrorPresentation {
  if (!isImportApiError(e)) {
    return {
      message: e instanceof Error ? e.message : 'Unknown error',
      suggestRePreview: false,
    };
  }

  const detail = (e.problem?.detail ?? e.message).toLowerCase();

  if (e.status === 409) {
    if (detail.includes('preview already committed') || detail.includes('preview consumed')) {
      return {
        message:
          'This preview was already saved to your library. Run Preview again if you want to import a fresh copy.',
        suggestRePreview: true,
      };
    }
    const existingSourceId = existingSourceIdFrom(e);
    if (
      existingSourceId ||
      detail.includes('already imported') ||
      detail.includes('source url already')
    ) {
      return {
        message: existingSourceId
          ? 'This recipe URL is already in your library. Open it from your library instead of importing again.'
          : 'This recipe URL is already in your library.',
        suggestRePreview: false,
      };
    }
  }

  if (e.status === 410 || detail.includes('preview expired')) {
    return {
      message: 'This preview expired. Run Preview again, review the draft, then save.',
      suggestRePreview: true,
    };
  }

  return {
    message: `${e.message}${e.status ? ` (${e.status})` : ''}`,
    suggestRePreview: false,
  };
}
