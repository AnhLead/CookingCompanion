import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ApiError, getVariant } from '../../src/api/client';
import type { RecipeStep, RecipeVariantDetail } from '../../src/api/types';
import { loadCachedVariant, rememberVariant } from '../../src/lib/offlineCache';
import { colors, layout } from '../../src/theme';

function provenanceFromVariant(v: Pick<RecipeVariantDetail, 'source'>): string {
  const src = v.source;
  return src
    ? [src.type, src.url, src.attribution].filter(Boolean).join(' · ')
    : 'No linked source';
}

export default function CookScreen() {
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [title, setTitle] = useState('');
  const [idx, setIdx] = useState(0);
  const [provenance, setProvenance] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const applyVariant = useCallback((v: Pick<RecipeVariantDetail, 'title' | 'steps' | 'source'>) => {
    setTitle(v.title);
    setSteps(v.steps.slice().sort((a, b) => a.order - b.order));
    setProvenance(provenanceFromVariant(v));
    setIdx(0);
  }, []);

  const load = useCallback(async () => {
    if (!variantId) return;
    setLoading(true);
    setError(null);
    setFromCache(false);
    try {
      const v = await getVariant(variantId);
      applyVariant(v);
      void rememberVariant(v);
    } catch (e) {
      const cached = await loadCachedVariant(variantId);
      if (cached) {
        applyVariant(cached);
        setFromCache(true);
        setError(null);
      } else {
        const msg =
          e instanceof ApiError
            ? `${e.message} (${e.status})`
            : e instanceof Error
              ? e.message
              : 'Failed to load';
        setError(msg);
        setTitle('');
        setSteps([]);
        setProvenance('');
      }
    } finally {
      setLoading(false);
    }
  }, [variantId, applyVariant]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const step = useMemo(() => steps[idx], [steps, idx]);

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

  return (
    <View style={[layout.screen, layout.pad]}>
      {fromCache ? (
        <View
          style={[
            layout.card,
            { borderColor: colors.accentMuted, marginBottom: 12 },
          ]}
        >
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Offline copy</Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 14 }}>
            Showing last cached snapshot. Reconnect to refresh from the server.
          </Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>Cooking</Text>
      <Text style={layout.title}>{title}</Text>
      <View style={[layout.card, { marginVertical: 12 }]}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>SOURCE</Text>
        <Text style={{ color: colors.text, marginTop: 6 }}>{provenance}</Text>
      </View>

      <View style={[layout.card, { minHeight: 200 }]}>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          Step {idx + 1} of {steps.length}
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '600', color: colors.text, marginTop: 12, lineHeight: 30 }}>
          {step.text}
        </Text>
        {step.timerSec ? (
          <Text style={{ color: colors.accent, marginTop: 16, fontWeight: '600' }}>
            Timer hint: {Math.round(step.timerSec / 60)} min
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <Pressable
          style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
          disabled={idx === 0}
          onPress={() => setIdx((i) => Math.max(0, i - 1))}
        >
          <Text style={[layout.btnSecondaryText, idx === 0 && { opacity: 0.4 }]}>Back</Text>
        </Pressable>
        <Pressable
          style={[layout.btn, { flex: 1 }]}
          onPress={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
        >
          <Text style={layout.btnText}>{idx >= steps.length - 1 ? 'Done' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
