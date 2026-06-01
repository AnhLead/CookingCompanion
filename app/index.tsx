import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import {
  appendSupportRef,
  createDish,
  isAbortError,
  isRetriableClientFailure,
  listDishes,
} from '../src/api/client';
import type { Dish } from '../src/api/types';
import { useHouseholdScope } from '../src/context/HouseholdScopeContext';
import { libraryErrorMessage } from '../src/lib/libraryErrorMessage';
import { listCachedVariants } from '../src/lib/offlineCache';
import type { RecipeVariantDetail } from '../src/api/types';
import { colors, layout } from '../src/theme';

const SEARCH_DEBOUNCE_MS = 320;

export default function LibraryScreen() {
  const router = useRouter();
  const { recipeScope, activeLabel } = useHouseholdScope();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cached, setCached] = useState<RecipeVariantDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [newDishOpen, setNewDishOpen] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishError, setNewDishError] = useState<string | null>(null);
  const [creatingDish, setCreatingDish] = useState(false);
  const loadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchText]);

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    setError(null);
    setLoading(true);
    try {
      const q = debouncedSearch.trim() || undefined;
      const [d, c] = await Promise.all([
        listDishes(recipeScope, { q, signal: ac.signal }),
        listCachedVariants(),
      ]);
      if (loadAbortRef.current !== ac) return;
      setDishes(d);
      setCached(c);
    } catch (e) {
      if (isAbortError(e) || ac.signal.aborted) return;
      if (loadAbortRef.current !== ac) return;
      const msg = e instanceof Error ? e.message : 'Failed to load';
      const hint = isRetriableClientFailure(e) ? ' Check your connection and pull to refresh or tap Retry.' : '';
      setError(appendSupportRef(`${msg}${hint}`, e));
    } finally {
      if (loadAbortRef.current === ac) {
        setLoading(false);
      }
    }
  }, [recipeScope, debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        loadAbortRef.current?.abort();
      };
    }, [load])
  );

  const closeNewDishModal = useCallback(() => {
    setNewDishOpen(false);
    setNewDishName('');
    setNewDishError(null);
  }, []);

  const submitNewDish = useCallback(async () => {
    const name = newDishName.trim();
    if (!name) {
      setNewDishError('Name is required');
      return;
    }
    setNewDishError(null);
    setCreatingDish(true);
    try {
      const dish = await createDish({ name }, recipeScope);
      closeNewDishModal();
      await load();
      router.push(`/dish/${dish.id}`);
    } catch (e) {
      if (isAbortError(e)) return;
      const msg = libraryErrorMessage(e, 'Could not create dish');
      const hint = isRetriableClientFailure(e)
        ? ' Check your connection and try again.'
        : '';
      setNewDishError(appendSupportRef(`${msg}${hint}`, e));
    } finally {
      setCreatingDish(false);
    }
  }, [newDishName, recipeScope, load, router, closeNewDishModal]);

  return (
    <View style={[layout.screen, { flex: 1 }]}>
      <View style={[layout.pad, { flex: 1 }]}>
        <Text style={layout.title}>Your dishes</Text>
        <Text style={layout.subtitle}>
          Variants, provenance, and import — MVP shell wired to `/api/v1` when
          `EXPO_PUBLIC_API_BASE_URL` is set.
        </Text>

        <Link href="/household" asChild>
          <Pressable
            style={[
              layout.card,
              {
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderColor: colors.accentMuted,
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>LIBRARY SCOPE</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4 }}>
                {activeLabel}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, fontSize: 14 }}>
                Recipes shown below are for this scope. Tap to switch household or personal.
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>Change</Text>
          </Pressable>
        </Link>

        <Text style={layout.label}>Search dishes</Text>
        <TextInput
          style={[layout.input, { marginBottom: 16 }]}
          placeholder="Name or tag"
          placeholderTextColor={colors.muted}
          value={searchText}
          onChangeText={setSearchText}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel="Search dishes"
        />

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <Link href="/import" asChild>
            <Pressable style={[layout.btn, { flex: 1 }]}>
              <Text style={layout.btnText}>Import recipe</Text>
            </Pressable>
          </Link>
          <Pressable
            style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
            onPress={() => {
              setNewDishOpen(true);
              setNewDishError(null);
            }}
            accessibilityLabel="Create new empty dish"
          >
            <Text style={layout.btnSecondaryText}>New dish</Text>
          </Pressable>
        </View>

        <Modal
          visible={newDishOpen}
          transparent
          animationType="fade"
          onRequestClose={creatingDish ? undefined : closeNewDishModal}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              justifyContent: 'center',
              padding: 24,
            }}
            onPress={creatingDish ? undefined : closeNewDishModal}
          >
            <Pressable
              style={[layout.card, { marginBottom: 0 }]}
              onPress={(ev) => ev.stopPropagation()}
            >
              <Text style={[layout.title, { fontSize: 20 }]}>New dish</Text>
              <Text style={[layout.subtitle, { marginBottom: 12 }]}>
                Creates an empty dish in this library scope. Add variants from the dish screen.
              </Text>
              <Text style={layout.label}>Name</Text>
              <TextInput
                style={[layout.input, { marginBottom: 12 }]}
                placeholder="e.g. Sunday roast"
                placeholderTextColor={colors.muted}
                value={newDishName}
                onChangeText={(t) => {
                  setNewDishName(t);
                  setNewDishError(null);
                }}
                editable={!creatingDish}
                autoFocus
                accessibilityLabel="New dish name"
                onSubmitEditing={() => void submitNewDish()}
              />
              {newDishError ? (
                <Text
                  style={{
                    color: colors.errorText,
                    fontWeight: '600',
                    marginBottom: 12,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  {newDishError}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
                  onPress={closeNewDishModal}
                  disabled={creatingDish}
                >
                  <Text style={layout.btnSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[layout.btn, { flex: 1, opacity: creatingDish ? 0.7 : 1 }]}
                  onPress={() => void submitNewDish()}
                  disabled={creatingDish}
                  accessibilityLabel="Save new dish"
                >
                  {creatingDish ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={layout.btnText}>Create</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

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
              {debouncedSearch.trim() ? 'No matching dishes' : 'No dishes yet'}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 22 }}>
              {debouncedSearch.trim()
                ? 'Try a different search or clear the field to see everything in this library scope.'
                : 'Seed data appears when the API is unavailable. Add a real backend URL or tap Import to create a demo dish locally.'}
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
