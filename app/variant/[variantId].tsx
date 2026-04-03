import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ApiError,
  applyVariantProfile,
  forkVariant,
  getVariant,
} from '../../src/api/client';
import type { ApplyVariantProfileResult, DairyMode, RecipeVariantDetail } from '../../src/api/types';
import { loadCachedVariant, rememberVariant } from '../../src/lib/offlineCache';
import { colors, layout } from '../../src/theme';

export default function VariantScreen() {
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const [v, setV] = useState<RecipeVariantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [dairyMode, setDairyMode] = useState<DairyMode>('none');
  const [omitTokensInput, setOmitTokensInput] = useState('');
  const [profilePreview, setProfilePreview] = useState<ApplyVariantProfileResult | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const load = useCallback(async () => {
    if (!variantId) return;
    setLoading(true);
    setError(null);
    setFromCache(false);
    try {
      const detail = await getVariant(variantId);
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
        setError(msg);
        setV(null);
      }
    } finally {
      setLoading(false);
    }
  }, [variantId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onFork = async () => {
    if (!variantId) return;
    try {
      const forked = await forkVariant(variantId);
      void rememberVariant(forked);
      router.replace(`/variant/${forked.id}`);
    } catch (e) {
      Alert.alert('Fork failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const onPreviewProfile = async () => {
    if (!variantId) return;
    const tokens = omitTokensInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setProfileLoading(true);
    try {
      const result = await applyVariantProfile(variantId, {
        dairyMode,
        omitTokens: tokens.length ? tokens : undefined,
      });
      setProfilePreview(result);
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.message} (${e.status})` : 'Preview failed';
      Alert.alert('Apply profile', msg);
    } finally {
      setProfileLoading(false);
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
    <ScrollView style={layout.screen} contentContainerStyle={layout.pad}>
      {fromCache ? (
        <View style={[layout.card, { borderColor: colors.accentMuted }]}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Offline copy</Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 14 }}>
            Showing last cached snapshot. Reconnect to refresh from the server.
          </Text>
        </View>
      ) : null}

      <Text style={layout.title}>{v.title}</Text>
      {v.yields ? <Text style={layout.subtitle}>Yields {v.yields}</Text> : null}

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
          Diet profile (preview)
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
          Slice C: try dairy handling and optional omit tokens. Preview only — does not change the saved
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
                  backgroundColor: selected ? colors.errorBg : colors.card,
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
            <Text style={layout.btnText}>{profileLoading ? '…' : 'Preview adjustments'}</Text>
          </Pressable>
          <Pressable
            style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
            onPress={() => setProfilePreview(null)}
          >
            <Text style={layout.btnSecondaryText}>Clear preview</Text>
          </Pressable>
        </View>
      </View>

      {profilePreview ? (
        <View style={[layout.card, { marginBottom: 20, borderColor: colors.accentMuted }]}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent, marginBottom: 8 }}>
            Adjusted preview (read-only)
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
            {profilePreview.summary}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>
            Ingredients
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
            Steps
          </Text>
          {profilePreview.adjustedSteps
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <View key={s.id} style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: '700', color: colors.accent }}>{s.order}.</Text>
                <Text style={{ color: colors.text, lineHeight: 22 }}>{s.text}</Text>
              </View>
            ))}
        </View>
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
  );
}
