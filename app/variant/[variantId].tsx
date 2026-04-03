import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ApiError, forkVariant, getVariant } from '../../src/api/client';
import type { RecipeVariantDetail } from '../../src/api/types';
import { loadCachedVariant, rememberVariant } from '../../src/lib/offlineCache';
import { colors, layout } from '../../src/theme';

export default function VariantScreen() {
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const [v, setV] = useState<RecipeVariantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

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
