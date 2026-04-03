import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { listDishes } from '../src/api/client';
import type { Dish } from '../src/api/types';
import { listCachedVariants } from '../src/lib/offlineCache';
import type { RecipeVariantDetail } from '../src/api/types';
import { colors, layout } from '../src/theme';

export default function LibraryScreen() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cached, setCached] = useState<RecipeVariantDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [d, c] = await Promise.all([listDishes(), listCachedVariants()]);
      setDishes(d);
      setCached(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <View style={[layout.screen, { flex: 1 }]}>
      <View style={[layout.pad, { flex: 1 }]}>
        <Text style={layout.title}>Your dishes</Text>
        <Text style={layout.subtitle}>
          Variants, provenance, and import — MVP shell wired to `/api/v1` when
          `EXPO_PUBLIC_API_BASE_URL` is set.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <Link href="/import" asChild>
            <Pressable style={[layout.btn, { flex: 1 }]}>
              <Text style={layout.btnText}>Import recipe</Text>
            </Pressable>
          </Link>
        </View>

        {error ? (
          <View
            style={[
              layout.card,
              { backgroundColor: colors.errorBg, borderColor: colors.errorText },
            ]}
          >
            <Text style={{ color: colors.errorText, fontWeight: '600' }}>{error}</Text>
            <Pressable onPress={() => void load()} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && dishes.length === 0 ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 24 }} />
        ) : null}

        {!loading && dishes.length === 0 && !error ? (
          <View style={layout.card}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
              No dishes yet
            </Text>
            <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 22 }}>
              Seed data appears when the API is unavailable. Add a real backend URL or tap
              Import to create a demo dish locally.
            </Text>
          </View>
        ) : null}

        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          data={dishes}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={loading && dishes.length > 0} onRefresh={() => void load()} />
          }
          renderItem={({ item }) => (
            <Link href={`/dish/${item.id}`} asChild>
              <Pressable style={layout.card}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
                  {item.name}
                </Text>
                {item.tags && item.tags.length > 0 ? (
                  <Text style={{ color: colors.muted, marginTop: 6 }}>{item.tags.join(' · ')}</Text>
                ) : null}
              </Pressable>
            </Link>
          )}
          ListFooterComponent={
            cached.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                <Text style={[layout.title, { fontSize: 18 }]}>Offline — recently viewed</Text>
                {cached.map((v) => (
                  <Link key={v.id} href={`/variant/${v.id}`} asChild>
                    <Pressable style={layout.card}>
                      <Text style={{ fontWeight: '600', color: colors.text }}>{v.title}</Text>
                      <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13 }}>
                        Cached copy · open without network when available
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}
