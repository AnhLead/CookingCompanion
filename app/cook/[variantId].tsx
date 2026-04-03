import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getVariant } from '../../src/api/client';
import type { RecipeStep } from '../../src/api/types';
import { rememberVariant } from '../../src/lib/offlineCache';
import { colors, layout } from '../../src/theme';

export default function CookScreen() {
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [title, setTitle] = useState('');
  const [idx, setIdx] = useState(0);
  const [provenance, setProvenance] = useState<string>('');

  const load = useCallback(async () => {
    if (!variantId) return;
    try {
      const v = await getVariant(variantId);
      setTitle(v.title);
      setSteps(v.steps.slice().sort((a, b) => a.order - b.order));
      const src = v.source;
      setProvenance(
        src
          ? [src.type, src.url, src.attribution].filter(Boolean).join(' · ')
          : 'No linked source'
      );
      void rememberVariant(v);
      setIdx(0);
    } catch {
      setTitle('');
      setSteps([]);
      setProvenance('Could not load variant');
    }
  }, [variantId]);

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

  if (!step && steps.length === 0) {
    return (
      <View style={[layout.screen, layout.pad]}>
        <Text style={{ color: colors.muted }}>Loading steps…</Text>
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
