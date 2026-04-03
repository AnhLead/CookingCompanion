import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { listVariants } from '../../src/api/client';
import type { RecipeVariantSummary } from '../../src/api/types';
import { colors, layout } from '../../src/theme';

export default function DishScreen() {
  const { dishId } = useLocalSearchParams<{ dishId: string }>();
  const [variants, setVariants] = useState<RecipeVariantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dishId) return;
    setLoading(true);
    setError(null);
    try {
      setVariants(await listVariants(dishId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load variants');
    } finally {
      setLoading(false);
    }
  }, [dishId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!dishId) {
    return (
      <View style={[layout.screen, layout.pad]}>
        <Text>Missing dish id</Text>
      </View>
    );
  }

  return (
    <View style={[layout.screen, { flex: 1 }]}>
      <View style={[layout.pad, { flex: 1 }]}>
        {loading && variants.length === 0 ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : null}

        {error ? (
          <View style={[layout.card, { backgroundColor: colors.errorBg }]}>
            <Text style={{ color: colors.errorText }}>{error}</Text>
            <Pressable onPress={() => void load()} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && variants.length === 0 && !error ? (
          <View style={layout.card}>
            <Text style={{ fontWeight: '600' }}>No variants for this dish</Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>
              Import or fork from another variant once the backend is live.
            </Text>
          </View>
        ) : null}

        <FlatList
          style={{ flex: 1 }}
          data={variants}
          keyExtractor={(v) => v.id}
          onRefresh={() => void load()}
          refreshing={loading && variants.length > 0}
          renderItem={({ item }) => (
            <Link href={`/variant/${item.id}`} asChild>
              <Pressable style={layout.card}>
                <View style={layout.rowBetween}>
                  <Text style={{ fontSize: 17, fontWeight: '600', flex: 1, color: colors.text }}>
                    {item.title}
                  </Text>
                  {item.isCanonical ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.accent,
                        marginLeft: 8,
                      }}
                    >
                      DEFAULT
                    </Text>
                  ) : null}
                </View>
                {item.sourceAttribution ? (
                  <Text style={{ color: colors.muted, marginTop: 6, fontSize: 14 }}>
                    Source: {item.sourceAttribution}
                  </Text>
                ) : null}
                {item.totalTimeMin != null ? (
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    ~{item.totalTimeMin} min
                  </Text>
                ) : null}
              </Pressable>
            </Link>
          )}
        />
      </View>
    </View>
  );
}
