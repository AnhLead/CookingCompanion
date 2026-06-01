import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  appendSupportRef,
  createVariant,
  deleteDish,
  getDish,
  isAbortError,
  isRetriableClientFailure,
  listVariants,
  patchDish,
} from '../../src/api/client';
import type { Dish, RecipeVariantSummary } from '../../src/api/types';
import { useHouseholdScope } from '../../src/context/HouseholdScopeContext';
import { getApiBaseUrl } from '../../src/lib/config';
import { libraryErrorMessage } from '../../src/lib/libraryErrorMessage';
import { colors, layout } from '../../src/theme';

function parseOptionalMinutes(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

export default function DishScreen() {
  const router = useRouter();
  const { recipeScope } = useHouseholdScope();
  const { dishId } = useLocalSearchParams<{ dishId: string }>();
  const apiConfigured = Boolean(getApiBaseUrl());
  const [dish, setDish] = useState<Dish | null>(null);
  const [variants, setVariants] = useState<RecipeVariantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [deletingDish, setDeletingDish] = useState(false);
  const [newVariantOpen, setNewVariantOpen] = useState(false);
  const [newVariantTitle, setNewVariantTitle] = useState('');
  const [newVariantYields, setNewVariantYields] = useState('');
  const [newVariantPrepMin, setNewVariantPrepMin] = useState('');
  const [newVariantCookMin, setNewVariantCookMin] = useState('');
  const [newVariantError, setNewVariantError] = useState<string | null>(null);
  const [creatingVariant, setCreatingVariant] = useState(false);

  const load = useCallback(async () => {
    if (!dishId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, v] = await Promise.all([getDish(dishId, recipeScope), listVariants(dishId, recipeScope)]);
      setDish(d);
      setVariants(v);
    } catch (e) {
      const msg = libraryErrorMessage(e, 'Failed to load dish', 'read');
      const hint = isRetriableClientFailure(e) ? ' Check your connection and try Retry.' : '';
      setError(`${msg}${hint}`);
    } finally {
      setLoading(false);
    }
  }, [dishId, recipeScope]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const closeNewVariantModal = useCallback(() => {
    setNewVariantOpen(false);
    setNewVariantTitle('');
    setNewVariantYields('');
    setNewVariantPrepMin('');
    setNewVariantCookMin('');
    setNewVariantError(null);
  }, []);

  const openNewVariantModal = useCallback(() => {
    setNewVariantOpen(true);
    setNewVariantError(null);
  }, []);

  const openEditNameModal = useCallback(() => {
    setEditNameValue(dish?.name ?? '');
    setEditNameError(null);
    setEditNameOpen(true);
  }, [dish?.name]);

  const closeEditNameModal = useCallback(() => {
    setEditNameOpen(false);
    setEditNameValue('');
    setEditNameError(null);
  }, []);

  const submitEditName = useCallback(async () => {
    if (!dishId) return;
    const name = editNameValue.trim();
    if (!name) {
      setEditNameError('Name is required');
      return;
    }
    setEditNameError(null);
    setSavingName(true);
    try {
      const updated = await patchDish(dishId, { name }, recipeScope);
      setDish(updated);
      closeEditNameModal();
    } catch (e) {
      if (isAbortError(e)) return;
      const msg = libraryErrorMessage(e, 'Could not update dish');
      const hint = isRetriableClientFailure(e) ? ' Check your connection and try again.' : '';
      setEditNameError(appendSupportRef(`${msg}${hint}`, e));
    } finally {
      setSavingName(false);
    }
  }, [dishId, editNameValue, recipeScope, closeEditNameModal]);

  const confirmDeleteDish = useCallback(() => {
    if (!dishId || deletingDish) return;
    Alert.alert(
      'Delete dish?',
      'This removes the dish and all its variants. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingDish(true);
              try {
                await deleteDish(dishId, recipeScope);
                router.replace('/');
              } catch (e) {
                const msg = libraryErrorMessage(e, 'Could not delete dish');
                const buttons = isRetriableClientFailure(e)
                  ? [
                      { text: 'Cancel', style: 'cancel' as const },
                      { text: 'Retry', onPress: () => confirmDeleteDish() },
                    ]
                  : [{ text: 'OK', style: 'cancel' as const }];
                Alert.alert('Delete failed', appendSupportRef(msg, e), buttons);
              } finally {
                setDeletingDish(false);
              }
            })();
          },
        },
      ]
    );
  }, [dishId, deletingDish, recipeScope, router]);

  const submitNewVariant = useCallback(async () => {
    if (!dishId) return;
    const title = newVariantTitle.trim();
    if (!title) {
      setNewVariantError('Title is required');
      return;
    }
    const prep = parseOptionalMinutes(newVariantPrepMin);
    const cook = parseOptionalMinutes(newVariantCookMin);
    if (prep === null || cook === null) {
      setNewVariantError('Prep and cook times must be whole minutes');
      return;
    }
    setNewVariantError(null);
    setCreatingVariant(true);
    try {
      const variant = await createVariant(
        dishId,
        {
          title,
          yields: newVariantYields.trim() || undefined,
          prepTimeMin: prep,
          cookTimeMin: cook,
        },
        recipeScope
      );
      closeNewVariantModal();
      await load();
      router.push(`/variant/${variant.id}`);
    } catch (e) {
      if (isAbortError(e)) return;
      const msg = libraryErrorMessage(e, 'Could not create variant');
      const hint = isRetriableClientFailure(e)
        ? ' Check your connection and try again.'
        : '';
      setNewVariantError(appendSupportRef(`${msg}${hint}`, e));
    } finally {
      setCreatingVariant(false);
    }
  }, [
    dishId,
    newVariantTitle,
    newVariantYields,
    newVariantPrepMin,
    newVariantCookMin,
    recipeScope,
    load,
    router,
    closeNewVariantModal,
  ]);

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
        {dish ? (
          <View style={[layout.card, { marginBottom: 16 }]}>
            <View style={layout.rowBetween}>
              <Text style={[layout.title, { flex: 1, marginBottom: 0 }]}>{dish.name}</Text>
              <Pressable
                onPress={openEditNameModal}
                accessibilityLabel="Edit dish name"
                hitSlop={8}
                style={{ marginLeft: 12 }}
              >
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Edit</Text>
              </Pressable>
            </View>
            {dish.tags && dish.tags.length > 0 ? (
              <Text style={{ color: colors.muted, marginTop: 8 }}>{dish.tags.join(' · ')}</Text>
            ) : null}
            <Pressable
              style={[layout.btn, layout.btnSecondary, { marginTop: 12, opacity: deletingDish ? 0.6 : 1 }]}
              onPress={confirmDeleteDish}
              disabled={deletingDish}
              accessibilityLabel="Delete dish"
            >
              {deletingDish ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={[layout.btnSecondaryText, { color: colors.errorText }]}>Delete dish</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <Pressable
            style={[layout.btn, { flex: 1 }]}
            onPress={openNewVariantModal}
            accessibilityLabel="Create new variant"
          >
            <Text style={layout.btnText}>New variant</Text>
          </Pressable>
        </View>

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
              {apiConfigured
                ? 'Tap New variant to add your first recipe version for this dish.'
                : 'Tap New variant to add a demo variant locally, or configure the API to persist recipes.'}
            </Text>
            <Pressable
              style={[layout.btn, layout.btnSecondary, { marginTop: 12 }]}
              onPress={openNewVariantModal}
            >
              <Text style={layout.btnSecondaryText}>New variant</Text>
            </Pressable>
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

      <Modal
        visible={newVariantOpen}
        transparent
        animationType="fade"
        onRequestClose={creatingVariant ? undefined : closeNewVariantModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={creatingVariant ? undefined : closeNewVariantModal}
        >
          <Pressable
            style={[layout.card, { marginBottom: 0 }]}
            onPress={(ev) => ev.stopPropagation()}
          >
            <Text style={[layout.title, { fontSize: 20 }]}>New variant</Text>
            <Text style={[layout.subtitle, { marginBottom: 12 }]}>
              Add a recipe version under this dish. Ingredients and steps can be filled in on the
              variant screen.
            </Text>
            <Text style={layout.label}>Title</Text>
            <TextInput
              style={[layout.input, { marginBottom: 12 }]}
              placeholder="e.g. Quick version"
              placeholderTextColor={colors.muted}
              value={newVariantTitle}
              onChangeText={(t) => {
                setNewVariantTitle(t);
                setNewVariantError(null);
              }}
              editable={!creatingVariant}
              autoFocus
              accessibilityLabel="New variant title"
              onSubmitEditing={() => void submitNewVariant()}
            />
            <Text style={layout.label}>Yields (optional)</Text>
            <TextInput
              style={[layout.input, { marginBottom: 12 }]}
              placeholder="e.g. 4 servings"
              placeholderTextColor={colors.muted}
              value={newVariantYields}
              onChangeText={setNewVariantYields}
              editable={!creatingVariant}
              accessibilityLabel="Variant yields"
            />
            <Text style={layout.label}>Prep time in minutes (optional)</Text>
            <TextInput
              style={[layout.input, { marginBottom: 12 }]}
              placeholder="e.g. 10"
              placeholderTextColor={colors.muted}
              value={newVariantPrepMin}
              onChangeText={setNewVariantPrepMin}
              editable={!creatingVariant}
              keyboardType="number-pad"
              accessibilityLabel="Prep time minutes"
            />
            <Text style={layout.label}>Cook time in minutes (optional)</Text>
            <TextInput
              style={[layout.input, { marginBottom: 12 }]}
              placeholder="e.g. 25"
              placeholderTextColor={colors.muted}
              value={newVariantCookMin}
              onChangeText={setNewVariantCookMin}
              editable={!creatingVariant}
              keyboardType="number-pad"
              accessibilityLabel="Cook time minutes"
            />
            {newVariantError ? (
              <Text
                style={{
                  color: colors.errorText,
                  fontWeight: '600',
                  marginBottom: 12,
                }}
                accessibilityLiveRegion="polite"
              >
                {newVariantError}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
                onPress={closeNewVariantModal}
                disabled={creatingVariant}
              >
                <Text style={layout.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[layout.btn, { flex: 1, opacity: creatingVariant ? 0.7 : 1 }]}
                onPress={() => void submitNewVariant()}
                disabled={creatingVariant}
              >
                {creatingVariant ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={layout.btnText}>Create</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editNameOpen}
        transparent
        animationType="fade"
        onRequestClose={savingName ? undefined : closeEditNameModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={savingName ? undefined : closeEditNameModal}
        >
          <Pressable
            style={[layout.card, { marginBottom: 0 }]}
            onPress={(ev) => ev.stopPropagation()}
          >
            <Text style={[layout.title, { fontSize: 20 }]}>Edit dish name</Text>
            <Text style={layout.label}>Name</Text>
            <TextInput
              style={[layout.input, { marginBottom: 12 }]}
              placeholder="Dish name"
              placeholderTextColor={colors.muted}
              value={editNameValue}
              onChangeText={(t) => {
                setEditNameValue(t);
                setEditNameError(null);
              }}
              editable={!savingName}
              autoFocus
              accessibilityLabel="Dish name"
              onSubmitEditing={() => void submitEditName()}
            />
            {editNameError ? (
              <Text
                style={{
                  color: colors.errorText,
                  fontWeight: '600',
                  marginBottom: 12,
                }}
                accessibilityLiveRegion="polite"
              >
                {editNameError}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={[layout.btn, layout.btnSecondary, { flex: 1 }]}
                onPress={closeEditNameModal}
                disabled={savingName}
              >
                <Text style={layout.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[layout.btn, { flex: 1, opacity: savingName ? 0.7 : 1 }]}
                onPress={() => void submitEditName()}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={layout.btnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
