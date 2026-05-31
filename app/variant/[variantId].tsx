import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ApiError,
  appendSupportRef,
  applyVariantProfile,
  deleteVariant,
  forkVariant,
  getRecipeAiFlags,
  getVariant,
  isAbortError,
  isRetriableClientFailure,
  patchVariant,
} from '../../src/api/client';
import type { ApplyVariantProfileResult, DairyMode, RecipeVariantDetail } from '../../src/api/types';
import { useHouseholdScope } from '../../src/context/HouseholdScopeContext';
import { loadCachedVariant, rememberVariant } from '../../src/lib/offlineCache';
import { diffIngredientLines, diffRecipeSteps, type IngredientLineDiff } from '../../src/lib/recipeDiff';
import { colors, layout } from '../../src/theme';

function parseOptionalMinutes(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

function minutesToField(value: number | null | undefined): string {
  return value != null ? String(value) : '';
}

function diffRowBg(status: IngredientLineDiff['status']): string {
  switch (status) {
    case 'removed':
      return colors.diffRemovedBg;
    case 'added':
      return colors.diffAddedBg;
    case 'changed':
      return colors.diffChangedBg;
    default:
      return colors.card;
  }
}

function ProfilePreviewPanel({
  v,
  profilePreview,
  profilePreviewMode,
}: {
  v: RecipeVariantDetail;
  profilePreview: ApplyVariantProfileResult;
  profilePreviewMode: 'rules' | 'generative' | null;
}) {
  const sortSteps = (steps: RecipeVariantDetail['steps']) =>
    steps.slice().sort((a, b) => a.order - b.order);
  const ingDiffs = diffIngredientLines(v.ingredients, profilePreview.adjustedIngredients);
  const stepDiffs = diffRecipeSteps(sortSteps(v.steps), sortSteps(profilePreview.adjustedSteps));
  const changedCount = ingDiffs.filter((d) => d.status !== 'unchanged').length;
  const changedSteps = stepDiffs.filter((d) => d.status !== 'unchanged').length;

  return (
    <View style={[layout.card, { marginBottom: 20, borderColor: colors.accentMuted }]}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent, marginBottom: 8 }}>
        Adjusted preview (read-only)
      </Text>
      {profilePreviewMode === 'generative' ? (
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
          AI-assisted path — compare to your saved variant below before relying on this text.
        </Text>
      ) : null}
      <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>{profilePreview.summary}</Text>

      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>
        Diff — ingredients ({changedCount} line{changedCount === 1 ? '' : 's'} changed)
      </Text>
      {ingDiffs.map((d) => {
        if (d.status === 'unchanged') {
          return (
            <Text key={d.id} style={{ marginBottom: 6, color: colors.muted, lineHeight: 22 }}>
              • {d.afterText}
            </Text>
          );
        }
        return (
          <View
            key={`${d.id}-${d.status}`}
            style={{
              backgroundColor: diffRowBg(d.status),
              padding: 10,
              borderRadius: 8,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.muted, marginBottom: 4 }}>
              {d.status.toUpperCase()}
            </Text>
            {d.beforeText != null ? (
              <Text
                style={{
                  color: colors.text,
                  textDecorationLine: d.status === 'removed' || d.status === 'changed' ? 'line-through' : 'none',
                  lineHeight: 22,
                }}
              >
                {d.beforeText}
              </Text>
            ) : null}
            {d.afterText != null && d.status !== 'removed' ? (
              <Text style={{ color: colors.text, lineHeight: 22, marginTop: d.beforeText != null ? 6 : 0 }}>
                {d.afterText}
              </Text>
            ) : null}
          </View>
        );
      })}

      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: colors.muted,
          marginTop: 8,
          marginBottom: 6,
        }}
      >
        Diff — steps ({changedSteps} step{changedSteps === 1 ? '' : 's'} changed)
      </Text>
      {stepDiffs.map((d) => {
        if (d.status === 'unchanged') {
          return (
            <View key={d.id} style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '700', color: colors.accentMuted }}>{d.order}.</Text>
              <Text style={{ color: colors.muted, lineHeight: 22 }}>{d.afterText}</Text>
            </View>
          );
        }
        return (
          <View
            key={`${d.id}-${d.status}`}
            style={{
              backgroundColor: diffRowBg(d.status),
              padding: 10,
              borderRadius: 8,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.muted, marginBottom: 4 }}>
              {d.status.toUpperCase()} · step {d.order ?? '—'}
            </Text>
            {d.beforeText != null ? (
              <Text
                style={{
                  color: colors.text,
                  textDecorationLine: d.status === 'removed' || d.status === 'changed' ? 'line-through' : 'none',
                  lineHeight: 22,
                }}
              >
                {d.beforeText}
              </Text>
            ) : null}
            {d.afterText != null && d.status !== 'removed' ? (
              <Text style={{ color: colors.text, lineHeight: 22, marginTop: d.beforeText != null ? 6 : 0 }}>
                {d.afterText}
              </Text>
            ) : null}
          </View>
        );
      })}

      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 8, marginBottom: 6 }}>
        Full adjusted ingredients
      </Text>
      {profilePreview.adjustedIngredients.map((ing) => (
        <Text key={ing.id} style={{ marginBottom: 8, color: colors.text, lineHeight: 22 }}>
          • {ing.text}
        </Text>
      ))}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: colors.muted,
          marginTop: 8,
          marginBottom: 6,
        }}
      >
        Full adjusted steps
      </Text>
      {sortSteps(profilePreview.adjustedSteps).map((s) => (
        <View key={s.id} style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: '700', color: colors.accent }}>{s.order}.</Text>
          <Text style={{ color: colors.text, lineHeight: 22 }}>{s.text}</Text>
        </View>
      ))}
    </View>
  );
}

export default function VariantScreen() {
  const { recipeScope } = useHouseholdScope();
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const [v, setV] = useState<RecipeVariantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [dairyMode, setDairyMode] = useState<DairyMode>('none');
  const [omitTokensInput, setOmitTokensInput] = useState('');
  const [profilePreview, setProfilePreview] = useState<ApplyVariantProfileResult | null>(null);
  const [profilePreviewMode, setProfilePreviewMode] = useState<'rules' | 'generative' | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [generativePreviewLoading, setGenerativePreviewLoading] = useState(false);
  const [generativeOptIn, setGenerativeOptIn] = useState(false);
  const [recipeAiFlags, setRecipeAiFlags] = useState<{ generativeAdjustmentsEnabled: boolean } | null>(
    null
  );
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editYields, setEditYields] = useState('');
  const [editPrepMin, setEditPrepMin] = useState('');
  const [editCookMin, setEditCookMin] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingVariant, setDeletingVariant] = useState(false);

  const load = useCallback(async () => {
    if (!variantId) return;
    setLoading(true);
    setError(null);
    setFromCache(false);
    try {
      const detail = await getVariant(variantId, recipeScope);
      setV(detail);
      void rememberVariant(detail);
    } catch (e) {
      const cached = await loadCachedVariant(variantId);
      if (cached) {
        setV(cached);
        setFromCache(true);
        setError(null);
      } else {
        const msg =
          e instanceof ApiError
            ? `${e.message} (${e.status})`
            : e instanceof Error
              ? e.message
              : 'Failed to load';
        setError(appendSupportRef(msg, e));
        setV(null);
      }
    } finally {
      setLoading(false);
    }
  }, [variantId, recipeScope]);

  const loadFlags = useCallback(async () => {
    setFlagsLoading(true);
    setFlagsError(null);
    try {
      const f = await getRecipeAiFlags(recipeScope);
      setRecipeAiFlags(f);
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.message} (${e.status})` : 'Could not load recipe AI flags';
      setFlagsError(appendSupportRef(msg, e));
      setRecipeAiFlags({ generativeAdjustmentsEnabled: false });
    } finally {
      setFlagsLoading(false);
    }
  }, [recipeScope]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadFlags();
    }, [load, loadFlags])
  );

  const onFork = async () => {
    if (!variantId) return;
    try {
      const forked = await forkVariant(variantId, recipeScope);
      void rememberVariant(forked);
      router.replace(`/variant/${forked.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const buttons = isRetriableClientFailure(e)
        ? [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Retry', onPress: () => void onFork() },
          ]
        : [{ text: 'OK', style: 'cancel' as const }];
      Alert.alert('Fork failed', appendSupportRef(msg, e), buttons);
    }
  };

  const openEditModal = useCallback(() => {
    if (!v) return;
    setEditTitle(v.title);
    setEditYields(v.yields ?? '');
    setEditPrepMin(minutesToField(v.prepTimeMin));
    setEditCookMin(minutesToField(v.cookTimeMin));
    setEditError(null);
    setEditOpen(true);
  }, [v]);

  const closeEditModal = useCallback(() => {
    setEditOpen(false);
    setEditError(null);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!variantId) return;
    const title = editTitle.trim();
    if (!title) {
      setEditError('Title is required');
      return;
    }
    const prep = parseOptionalMinutes(editPrepMin);
    const cook = parseOptionalMinutes(editCookMin);
    if (prep === null || cook === null) {
      setEditError('Prep and cook times must be whole minutes');
      return;
    }
    setEditError(null);
    setSavingEdit(true);
    try {
      const updated = await patchVariant(
        variantId,
        {
          title,
          yields: editYields.trim() || undefined,
          prepTimeMin: prep,
          cookTimeMin: cook,
        },
        recipeScope
      );
      setV(updated);
      void rememberVariant(updated);
      closeEditModal();
    } catch (e) {
      if (isAbortError(e)) return;
      const msg = e instanceof Error ? e.message : 'Could not update variant';
      const hint = isRetriableClientFailure(e) ? ' Check your connection and try again.' : '';
      setEditError(appendSupportRef(`${msg}${hint}`, e));
    } finally {
      setSavingEdit(false);
    }
  }, [variantId, editTitle, editYields, editPrepMin, editCookMin, recipeScope, closeEditModal]);

  const confirmDeleteVariant = useCallback(() => {
    if (!variantId || !v || deletingVariant) return;
    Alert.alert(
      'Delete variant?',
      'This removes this recipe version permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingVariant(true);
              try {
                await deleteVariant(variantId, recipeScope);
                router.replace(`/dish/${v.dishId}`);
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Could not delete variant';
                const buttons = isRetriableClientFailure(e)
                  ? [
                      { text: 'Cancel', style: 'cancel' as const },
                      { text: 'Retry', onPress: () => confirmDeleteVariant() },
                    ]
                  : [{ text: 'OK', style: 'cancel' as const }];
                Alert.alert('Delete failed', appendSupportRef(msg, e), buttons);
              } finally {
                setDeletingVariant(false);
              }
            })();
          },
        },
      ]
    );
  }, [variantId, v, deletingVariant, recipeScope]);

  const previewErrorMessage = (e: unknown, mode: 'rules' | 'generative'): string => {
    if (e instanceof ApiError && mode === 'generative' && e.status === 403) {
      return appendSupportRef(
        'AI-assisted adjustments are turned off on this server. ' +
          'Use rule-based preview below, or ask your administrator to enable them.',
        e
      );
    }
    if (e instanceof ApiError && mode === 'generative' && e.status === 503) {
      return appendSupportRef(
        'AI-assisted adjustments are enabled but not configured on this server (missing provider setup). ' +
          'Use rule-based preview below, or ask your administrator to configure the provider.',
        e
      );
    }
    if (e instanceof ApiError) {
      return appendSupportRef(`${e.message} (${e.status})`, e);
    }
    return 'Preview failed';
  };

  const onPreviewProfile = async () => {
    if (!variantId) return;
    const tokens = omitTokensInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setProfileLoading(true);
    try {
      const result = await applyVariantProfile(
        variantId,
        {
          dairyMode,
          omitTokens: tokens.length ? tokens : undefined,
        },
        recipeScope
      );
      setProfilePreview(result);
      setProfilePreviewMode('rules');
    } catch (e) {
      const msg = previewErrorMessage(e, 'rules');
      const buttons = isRetriableClientFailure(e)
        ? [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Retry', onPress: () => void onPreviewProfile() },
          ]
        : [{ text: 'OK', style: 'cancel' as const }];
      Alert.alert('Rule-based preview', msg, buttons);
    } finally {
      setProfileLoading(false);
    }
  };

  const onPreviewGenerative = async () => {
    if (!variantId || !generativeOptIn) return;
    const tokens = omitTokensInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setGenerativePreviewLoading(true);
    try {
      const result = await applyVariantProfile(
        variantId,
        {
          dairyMode,
          omitTokens: tokens.length ? tokens : undefined,
          useGenerative: true,
        },
        recipeScope
      );
      setProfilePreview(result);
      setProfilePreviewMode('generative');
    } catch (e) {
      const msg = previewErrorMessage(e, 'generative');
      const buttons = isRetriableClientFailure(e)
        ? [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Retry', onPress: () => void onPreviewGenerative() },
          ]
        : [{ text: 'OK', style: 'cancel' as const }];
      Alert.alert('AI-assisted preview', msg, buttons);
    } finally {
      setGenerativePreviewLoading(false);
    }
  };

  const dairyOptions: { mode: DairyMode; label: string }[] = [
    { mode: 'none', label: 'No dairy rule' },
    { mode: 'omit', label: 'Omit dairy' },
    { mode: 'substitute_oat', label: 'Oat subs' },
  ];

  if (!variantId) {
    return (
      <View style={[layout.screen, layout.pad]}>
        <Text>Missing variant</Text>
      </View>
    );
  }

  if (loading && !v) {
    return (
      <View style={[layout.screen, layout.pad]}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  if (error && !v) {
    return (
      <View style={[layout.screen, layout.pad]}>
        <View style={[layout.card, { backgroundColor: colors.errorBg }]}>
          <Text style={{ color: colors.errorText, fontWeight: '600' }}>{error}</Text>
          <Pressable onPress={() => void load()} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!v) return null;

  return (
    <>
    <ScrollView style={layout.screen} contentContainerStyle={layout.pad}>
      {fromCache ? (
        <View style={[layout.card, { borderColor: colors.accentMuted }]}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Offline copy</Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 14 }}>
            Showing last cached snapshot. Reconnect to refresh from the server.
          </Text>
        </View>
      ) : null}

      <View style={layout.rowBetween}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={layout.title}>{v.title}</Text>
          {v.yields ? <Text style={layout.subtitle}>Yields {v.yields}</Text> : null}
          {v.totalTimeMin != null ? (
            <Text style={{ color: colors.muted, marginTop: 4 }}>~{v.totalTimeMin} min total</Text>
          ) : null}
        </View>
        <Pressable onPress={openEditModal} accessibilityLabel="Edit variant" hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Edit</Text>
        </Pressable>
      </View>

      <Pressable
        style={[
          layout.btn,
          layout.btnSecondary,
          { marginBottom: 16, opacity: deletingVariant ? 0.6 : 1 },
        ]}
        onPress={confirmDeleteVariant}
        disabled={deletingVariant}
        accessibilityLabel="Delete variant"
      >
        {deletingVariant ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={[layout.btnSecondaryText, { color: colors.errorText }]}>Delete variant</Text>
        )}
      </Pressable>

      <View style={[layout.card, { marginBottom: 16 }]}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>
          Provenance
        </Text>
        {v.source ? (
          <>
            <Text style={{ color: colors.text }}>
              {v.source.type.toUpperCase()}
              {v.source.url ? ` · ${v.source.url}` : ''}
            </Text>
            {v.source.attribution ? (
              <Text style={{ color: colors.muted, marginTop: 6 }}>{v.source.attribution}</Text>
            ) : null}
          </>
        ) : (
          <Text style={{ color: colors.muted }}>No source on file</Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <Link href={`/cook/${v.id}`} asChild>
          <Pressable style={[layout.btn, { flex: 1 }]}>
            <Text style={layout.btnText}>Cook</Text>
          </Pressable>
        </Link>
        <Pressable
          style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
          onPress={() => void onFork()}
        >
          <Text style={layout.btnSecondaryText}>Fork variant</Text>
        </Pressable>
      </View>

      <View style={[layout.card, { marginBottom: 20 }]}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 8 }}>
          AI-assisted adjustments (flagged)
        </Text>
        {flagsLoading ? (
          <Text style={{ color: colors.muted, fontSize: 14 }}>Checking server capabilities…</Text>
        ) : flagsError ? (
          <View style={{ backgroundColor: colors.errorBg, borderRadius: 8, padding: 10 }}>
            <Text style={{ color: colors.errorText, fontSize: 14 }}>{flagsError}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
              AI-assisted preview is unavailable until flags load. Rule-based preview below still works.
            </Text>
          </View>
        ) : recipeAiFlags?.generativeAdjustmentsEnabled ? (
          <>
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
              Opt in before requesting an AI-assisted preview. Results are preview-only (nothing is saved to
              this variant automatically). Review the diff, then cancel or keep iterating.
            </Text>
            <View style={[layout.rowBetween, { marginBottom: 12 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                  Use AI-assisted preview
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
                  Sends your current diet rules to the server as an assisted adjustment request.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Opt in to AI-assisted recipe preview"
                value={generativeOptIn}
                onValueChange={setGenerativeOptIn}
                trackColor={{ false: colors.border, true: colors.accentMuted }}
                thumbColor={generativeOptIn ? colors.accent : '#f4f4f5'}
              />
            </View>
            <Pressable
              style={[
                layout.btn,
                { opacity: !generativeOptIn || generativePreviewLoading ? 0.5 : 1, marginBottom: 8 },
              ]}
              disabled={!generativeOptIn || generativePreviewLoading}
              onPress={() => void onPreviewGenerative()}
            >
              <Text style={layout.btnText}>
                {generativePreviewLoading ? '…' : 'Preview AI-assisted adjustments'}
              </Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Uses the same dairy and omit settings as rule-based preview. Turn off the switch to withdraw
              opt-in.
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            AI-assisted adjustments are not enabled on this server (or the flags endpoint is missing).
            Rule-based diet preview below still works.
          </Text>
        )}
      </View>

      <View style={[layout.card, { marginBottom: 20 }]}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 8 }}>
          Rule-based diet preview
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
          Deterministic dairy handling and optional omit tokens. Preview only — does not change the saved
          variant.
        </Text>
        <Text style={layout.label}>Dairy mode</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {dairyOptions.map(({ mode, label }) => {
            const selected = dairyMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setDairyMode(mode)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.chipSelectedBg : colors.card,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: selected ? colors.accent : colors.text,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={layout.label}>Omit tokens (optional)</Text>
        <TextInput
          style={[layout.input, { marginBottom: 12 }]}
          placeholder="e.g. cilantro, nuts — comma-separated"
          placeholderTextColor={colors.muted}
          value={omitTokensInput}
          onChangeText={setOmitTokensInput}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            style={[layout.btn, { flex: 1, opacity: profileLoading ? 0.5 : 1 }]}
            disabled={profileLoading}
            onPress={() => void onPreviewProfile()}
          >
            <Text style={layout.btnText}>{profileLoading ? '…' : 'Preview rule-based adjustments'}</Text>
          </Pressable>
          <Pressable
            style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
            onPress={() => {
              setProfilePreview(null);
              setProfilePreviewMode(null);
            }}
          >
            <Text style={layout.btnSecondaryText}>Cancel preview</Text>
          </Pressable>
        </View>
      </View>

      {profilePreview ? (
        <ProfilePreviewPanel
          v={v}
          profilePreview={profilePreview}
          profilePreviewMode={profilePreviewMode}
        />
      ) : null}

      <Text style={[layout.title, { fontSize: 20 }]}>Ingredients</Text>
      {v.ingredients.map((ing) => (
        <Text key={ing.id} style={{ marginBottom: 8, color: colors.text, lineHeight: 22 }}>
          • {ing.text}
        </Text>
      ))}

      <Text style={[layout.title, { fontSize: 20, marginTop: 16 }]}>Steps</Text>
      {v.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => (
          <View key={s.id} style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', color: colors.accent }}>{s.order}.</Text>
            <Text style={{ color: colors.text, lineHeight: 22 }}>{s.text}</Text>
          </View>
        ))}
    </ScrollView>

    <Modal
      visible={editOpen}
      transparent
      animationType="fade"
      onRequestClose={savingEdit ? undefined : closeEditModal}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          padding: 24,
        }}
        onPress={savingEdit ? undefined : closeEditModal}
      >
        <Pressable
          style={[layout.card, { marginBottom: 0 }]}
          onPress={(ev) => ev.stopPropagation()}
        >
          <Text style={[layout.title, { fontSize: 20 }]}>Edit variant</Text>
          <Text style={layout.label}>Title</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="Variant title"
            placeholderTextColor={colors.muted}
            value={editTitle}
            onChangeText={(t) => {
              setEditTitle(t);
              setEditError(null);
            }}
            editable={!savingEdit}
            autoFocus
            accessibilityLabel="Variant title"
          />
          <Text style={layout.label}>Yields (optional)</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="e.g. 4 servings"
            placeholderTextColor={colors.muted}
            value={editYields}
            onChangeText={setEditYields}
            editable={!savingEdit}
            accessibilityLabel="Variant yields"
          />
          <Text style={layout.label}>Prep time in minutes (optional)</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="e.g. 10"
            placeholderTextColor={colors.muted}
            value={editPrepMin}
            onChangeText={setEditPrepMin}
            editable={!savingEdit}
            keyboardType="number-pad"
            accessibilityLabel="Prep time minutes"
          />
          <Text style={layout.label}>Cook time in minutes (optional)</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="e.g. 25"
            placeholderTextColor={colors.muted}
            value={editCookMin}
            onChangeText={setEditCookMin}
            editable={!savingEdit}
            keyboardType="number-pad"
            accessibilityLabel="Cook time minutes"
          />
          {editError ? (
            <Text
              style={{
                color: colors.errorText,
                fontWeight: '600',
                marginBottom: 12,
              }}
              accessibilityLiveRegion="polite"
            >
              {editError}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
              onPress={closeEditModal}
              disabled={savingEdit}
            >
              <Text style={layout.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[layout.btn, { flex: 1, opacity: savingEdit ? 0.7 : 1 }]}
              onPress={() => void submitEdit()}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={layout.btnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}
