import { useCallback, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as KeepAwake from 'expo-keep-awake';
import { Pressable, Text, View } from 'react-native';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getVariant } from '../../src/api/client';
import type { RecipeStep, RecipeVariantDetail } from '../../src/api/types';
import { useHouseholdScope } from '../../src/context/HouseholdScopeContext';
import { StepTimer } from '../../src/components/StepTimer';
import { libraryErrorMessage } from '../../src/lib/libraryErrorMessage';
import { loadCachedVariant, rememberVariant } from '../../src/lib/offlineCache';
import { colors, layout } from '../../src/theme';

const KEEP_AWAKE_TAG = 'cook-variant-screen';
/** Minimum tappable height (dp) for step controls */
const STEP_CONTROL_MIN_HEIGHT = 52;

function provenanceFromVariant(v: Pick<RecipeVariantDetail, 'source'>): string {
  const src = v.source;
  return src
    ? [src.type, src.url, src.attribution].filter(Boolean).join(' · ')
    : 'No linked source';
}

function OfflineBanner() {
  return (
    <View style={[layout.card, { borderColor: colors.accentMuted, marginBottom: 12 }]}>
      <Text style={{ color: colors.accent, fontWeight: '600' }}>Offline copy</Text>
      <Text style={{ color: colors.muted, marginTop: 4, fontSize: 14 }}>
        Showing last cached snapshot. Reconnect to refresh from the server.
      </Text>
    </View>
  );
}

export default function CookScreen() {
  const { recipeScope } = useHouseholdScope();
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [title, setTitle] = useState('');
  const [idx, setIdx] = useState(0);
  const [provenance, setProvenance] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [completed, setCompleted] = useState(false);

  const applyVariant = useCallback((v: Pick<RecipeVariantDetail, 'title' | 'steps' | 'source'>) => {
    setTitle(v.title);
    setSteps(v.steps.slice().sort((a, b) => a.order - b.order));
    setProvenance(provenanceFromVariant(v));
    setIdx(0);
    setCompleted(false);
  }, []);

  const load = useCallback(async () => {
    if (!variantId) return;
    setLoading(true);
    setError(null);
    setFromCache(false);
    try {
      const v = await getVariant(variantId, recipeScope);
      applyVariant(v);
      void rememberVariant(v);
    } catch (e) {
      const cached = await loadCachedVariant(variantId);
      if (cached) {
        applyVariant(cached);
        setFromCache(true);
        setError(null);
      } else {
        setError(libraryErrorMessage(e, 'Failed to load', 'read'));
        setTitle('');
        setSteps([]);
        setProvenance('');
      }
    } finally {
      setLoading(false);
    }
  }, [variantId, applyVariant, recipeScope]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      void KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      return () => {
        void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
      };
    }, [])
  );

  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  const finishCook = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCompleted(true);
  }, []);

  const goNext = useCallback(() => {
    if (idx >= steps.length - 1) {
      finishCook();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIdx((i) => i + 1);
  }, [idx, steps.length, finishCook]);

  const step = useMemo(() => steps[idx], [steps, idx]);
  const isLastStep = idx >= steps.length - 1;

  if (!variantId) {
    return (
      <View style={[layout.screen, layout.pad]}>
        <Text>Missing variant</Text>
      </View>
    );
  }

  if (loading && steps.length === 0) {
    return (
      <View style={[layout.screen, layout.pad]}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  if (error && steps.length === 0) {
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

  if (!step) {
    return (
      <View style={[layout.screen, layout.pad]}>
        <Text>No steps for this variant.</Text>
      </View>
    );
  }

  if (completed) {
    const stepCount = steps.length;
    const stepLabel = stepCount === 1 ? '1 step' : `${stepCount} steps`;
    return (
      <View style={[layout.screen, layout.pad]}>
        {fromCache ? <OfflineBanner /> : null}
        <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>Finished</Text>
        <Text style={layout.title}>{title}</Text>
        <View style={[layout.card, { marginVertical: 20 }]}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Nice work!</Text>
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 16, lineHeight: 22 }}>
            You completed {stepLabel} in cook mode.
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          <Link href={`/variant/${variantId}`} asChild>
            <Pressable
              style={({ pressed }) => [layout.btn, { opacity: pressed ? 0.92 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Back to variant"
            >
              <Text style={layout.btnText}>Back to variant</Text>
            </Pressable>
          </Link>
          <Link href="/" asChild>
            <Pressable
              style={({ pressed }) => [
                layout.btn,
                layout.btnSecondary,
                { opacity: pressed ? 0.92 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back to library"
            >
              <Text style={layout.btnSecondaryText}>Back to library</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View style={[layout.screen, layout.pad]}>
      {fromCache ? <OfflineBanner /> : null}
      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>Cooking</Text>
      <Text style={layout.title}>{title}</Text>
      <View style={[layout.card, { marginVertical: 12 }]}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>SOURCE</Text>
        <Text style={{ color: colors.text, marginTop: 6 }}>{provenance}</Text>
      </View>

      <View
        style={[layout.card, { minHeight: 200 }]}
        accessible
        accessibilityLabel={[
          `Step ${idx + 1} of ${steps.length}`,
          step.text,
          step.timerSec ? `${Math.round(step.timerSec / 60)} minute step timer available` : '',
        ]
          .filter(Boolean)
          .join('. ')}
      >
        <Text style={{ fontSize: 14, color: colors.muted }} accessible={false}>
          Step {idx + 1} of {steps.length}
        </Text>
        <Text
          style={{ fontSize: 22, fontWeight: '600', color: colors.text, marginTop: 12, lineHeight: 30 }}
          accessible={false}
        >
          {step.text}
        </Text>
        {step.timerSec ? (
          <StepTimer durationSec={step.timerSec} stepKey={step.id ?? String(idx)} />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <Pressable
          style={({ pressed }) => [
            layout.btn,
            layout.btnSecondary,
            {
              flex: 1,
              minHeight: STEP_CONTROL_MIN_HEIGHT,
              justifyContent: 'center',
              opacity: pressed && idx > 0 ? 0.92 : 1,
            },
          ]}
          disabled={idx === 0}
          onPress={goPrev}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous recipe step"
          accessibilityState={{ disabled: idx === 0 }}
        >
          <Text style={[layout.btnSecondaryText, idx === 0 && { opacity: 0.4 }]}>Back</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            layout.btn,
            {
              flex: 1,
              minHeight: STEP_CONTROL_MIN_HEIGHT,
              justifyContent: 'center',
              opacity: pressed ? 0.92 : 1,
            },
          ]}
          onPress={goNext}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Finish recipe' : 'Next recipe step'}
        >
          <Text style={layout.btnText}>{isLastStep ? 'Done' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
