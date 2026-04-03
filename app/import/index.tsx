import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ApiError,
  importCommit,
  importPreview,
  isAbortError,
  isRetriableClientFailure,
} from '../../src/api/client';
import type { ImportPreviewResponse, IngredientLine, RecipeStep } from '../../src/api/types';
import { useHouseholdScope } from '../../src/context/HouseholdScopeContext';
import { colors, layout } from '../../src/theme';

function linesToIngredients(text: string): IngredientLine[] {
  return text
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((line, i) => ({ id: `ing-${i}`, text: line }));
}

function linesToSteps(text: string): RecipeStep[] {
  return text
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((line, i) => ({ id: `st-${i}`, order: i + 1, text: line }));
}

function formatSourceSummary(p: ImportPreviewResponse, urlInput: string, hadHtml: boolean): string {
  const src = p.draft.source;
  if (src?.url) return src.url;
  if (urlInput.trim()) return urlInput.trim();
  if (hadHtml) return 'Pasted HTML / text';
  return 'Manual';
}

export default function ImportScreen() {
  const { recipeScope, activeLabel } = useHouseholdScope();
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [dishName, setDishName] = useState('');
  const [title, setTitle] = useState('');
  const [yields, setYields] = useState('');
  const [totalTimeMin, setTotalTimeMin] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const previewGen = useRef(0);
  const commitGen = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);
  const commitAbortRef = useRef<AbortController | null>(null);

  const busy = previewLoading || commitLoading;

  const applyPreview = (p: ImportPreviewResponse) => {
    setPreview(p);
    const d = p.draft;
    setDishName(d.dishName ?? '');
    setTitle(d.title ?? '');
    setYields(d.yields?.trim() ? d.yields : '');
    setTotalTimeMin(
      d.totalTimeMin != null && Number.isFinite(d.totalTimeMin) ? String(d.totalTimeMin) : ''
    );
    setIngredientsText((d.ingredients ?? []).map((i) => i.text).join('\n'));
    setStepsText((d.steps ?? []).sort((a, b) => a.order - b.order).map((s) => s.text).join('\n'));
  };

  const discardDraft = () => {
    previewAbortRef.current?.abort();
    commitAbortRef.current?.abort();
    setPreview(null);
    setDishName('');
    setTitle('');
    setYields('');
    setTotalTimeMin('');
    setIngredientsText('');
    setStepsText('');
    setPreviewError(null);
    setCommitError(null);
  };

  const confirmDiscardDraft = () => {
    Alert.alert(
      'Discard draft?',
      'Your parsed recipe and edits will be cleared. You can run Preview again from the same URL or paste.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discardDraft },
      ]
    );
  };

  const cancelPreviewRequest = () => {
    previewAbortRef.current?.abort();
  };

  const cancelCommitRequest = () => {
    commitAbortRef.current?.abort();
  };

  const runPreview = async () => {
    setPreviewError(null);
    const body =
      html.trim().length > 0
        ? { html: html.trim() }
        : url.trim().length > 0
          ? { url: url.trim() }
          : null;
    if (!body) {
      Alert.alert('Need input', 'Paste a URL or HTML snippet.');
      return;
    }

    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;
    const myId = ++previewGen.current;
    setPreviewLoading(true);
    try {
      const res = await importPreview(body, { signal: ac.signal, scope: recipeScope });
      if (myId !== previewGen.current) return;
      applyPreview(res);
    } catch (e) {
      if (myId !== previewGen.current) return;
      if (isAbortError(e)) return;
      const msg =
        e instanceof ApiError ? `${e.message}${e.status ? ` (${e.status})` : ''}` : e instanceof Error ? e.message : 'Unknown error';
      const hint = isRetriableClientFailure(e) ? ' Check your connection and try again.' : '';
      setPreviewError(`${msg}${hint}`);
    } finally {
      if (myId === previewGen.current) setPreviewLoading(false);
    }
  };

  const runCommit = async () => {
    if (!dishName.trim() || !title.trim()) {
      Alert.alert('Validation', 'Dish name and variant title are required.');
      return;
    }
    const ingredients = linesToIngredients(ingredientsText);
    const steps = linesToSteps(stepsText);
    if (ingredients.length === 0 || steps.length === 0) {
      Alert.alert('Validation', 'Add at least one ingredient line and one step line.');
      return;
    }

    setCommitError(null);
    commitAbortRef.current?.abort();
    const ac = new AbortController();
    commitAbortRef.current = ac;
    const myId = ++commitGen.current;
    setCommitLoading(true);
    try {
      const timeParsed = totalTimeMin.trim() === '' ? null : Number(totalTimeMin.trim());
      const variant: Parameters<typeof importCommit>[0]['variant'] = {
        title: title.trim(),
        ingredients,
        steps,
        source: preview?.draft.source ?? {
          type: url.trim() ? 'web' : 'manual',
          url: url.trim() || null,
          attribution: url.trim() || html.trim() || 'manual import',
        },
      };
      if (yields.trim()) variant.yields = yields.trim();
      if (timeParsed != null && Number.isFinite(timeParsed)) variant.totalTimeMin = timeParsed;

      const { variantId } = await importCommit(
        {
          previewId: preview?.previewId,
          dishName: dishName.trim(),
          variant,
        },
        { signal: ac.signal, scope: recipeScope }
      );
      if (myId !== commitGen.current) return;
      router.replace(`/variant/${variantId}`);
    } catch (e) {
      if (myId !== commitGen.current) return;
      if (isAbortError(e)) return;
      const msg =
        e instanceof ApiError ? `${e.message}${e.status ? ` (${e.status})` : ''}` : e instanceof Error ? e.message : 'Unknown error';
      const hint = isRetriableClientFailure(e) ? ' You can retry save.' : '';
      setCommitError(`${msg}${hint}`);
    } finally {
      if (myId === commitGen.current) setCommitLoading(false);
    }
  };

  return (
    <ScrollView style={layout.screen} contentContainerStyle={[layout.pad, { paddingBottom: 40 }]}>
      <Text style={layout.title}>Import</Text>
      <Text style={layout.subtitle}>
        Paste a recipe URL or raw HTML. Preview fills a draft; edit, then save (commit). Saves go to{' '}
        <Text style={{ fontWeight: '700', color: colors.text }}>{activeLabel}</Text> (change under Household on the
        Library tab).
      </Text>

      <Text style={layout.label}>Recipe URL</Text>
      <TextInput
        style={[layout.input, { marginBottom: 12 }]}
        placeholder="https://…"
        placeholderTextColor={colors.muted}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />

      <Text style={layout.label}>Or paste HTML / text</Text>
      <TextInput
        style={[layout.input, { minHeight: 120, textAlignVertical: 'top' }]}
        placeholder="Optional: paste page HTML or rough text"
        placeholderTextColor={colors.muted}
        multiline
        value={html}
        onChangeText={setHtml}
        editable={!busy}
      />

      {previewLoading ? (
        <View
          style={[
            layout.card,
            {
              marginTop: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              borderColor: colors.accentMuted,
            },
          ]}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '600' }}>Fetching preview…</Text>
          </View>
          <Pressable onPress={cancelPreviewRequest} hitSlop={8}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={[layout.btn, { marginTop: previewLoading ? 12 : 8, opacity: previewLoading ? 0.6 : 1 }]}
        onPress={() => void runPreview()}
        disabled={busy}
      >
        <Text style={layout.btnText}>Preview</Text>
      </Pressable>

      {previewError ? (
        <View
          style={[
            layout.card,
            { marginTop: 16, backgroundColor: colors.errorBg, borderColor: colors.errorText },
          ]}
        >
          <Text style={{ color: colors.errorText, fontWeight: '600' }}>{previewError}</Text>
          <Pressable onPress={() => void runPreview()} style={{ marginTop: 10 }} disabled={busy}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Retry preview</Text>
          </Pressable>
        </View>
      ) : null}

      {preview?.warnings?.length ? (
        <View style={[layout.card, { marginTop: 16, borderColor: colors.accentMuted }]}>
          {preview.warnings.map((w, i) => (
            <Text key={i} style={{ color: colors.muted, marginBottom: 6 }}>
              • {w}
            </Text>
          ))}
        </View>
      ) : null}

      {preview ? (
        <>
          <Text style={[layout.title, { fontSize: 20, marginTop: 24 }]}>Review parsed recipe</Text>
          <View style={[layout.card, { marginBottom: 8 }]}>
            <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8 }}>
              Summary (from preview)
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 4 }}>
              Source: {formatSourceSummary(preview, url, html.trim().length > 0)}
            </Text>
            {preview.parseConfidence != null ? (
              <Text style={{ color: colors.muted, marginBottom: 4 }}>
                Parse confidence: {Math.round(Math.min(1, Math.max(0, preview.parseConfidence)) * 100)}%
              </Text>
            ) : null}
            <Text style={{ color: colors.muted }}>
              {(ingredientsText.split('\n').filter((l) => l.trim()).length || 0)} ingredient lines ·{' '}
              {(stepsText.split('\n').filter((l) => l.trim()).length || 0)} steps
            </Text>
            <Text style={{ color: colors.muted, marginTop: 10, fontSize: 13 }}>
              Adjust fields below, then save to your library or discard to start over.
            </Text>
          </View>

          <Text style={[layout.title, { fontSize: 20, marginTop: 8 }]}>Edit draft</Text>

          <Text style={layout.label}>Dish name</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            value={dishName}
            onChangeText={setDishName}
            editable={!busy}
          />

          <Text style={layout.label}>Variant title</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            value={title}
            onChangeText={setTitle}
            editable={!busy}
          />

          <Text style={layout.label}>Yields (optional)</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="e.g. 4 servings"
            placeholderTextColor={colors.muted}
            value={yields}
            onChangeText={setYields}
            editable={!busy}
          />

          <Text style={layout.label}>Total time, minutes (optional)</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="e.g. 45"
            placeholderTextColor={colors.muted}
            value={totalTimeMin}
            onChangeText={setTotalTimeMin}
            keyboardType="number-pad"
            editable={!busy}
          />

          <Text style={layout.label}>Ingredients (one per line)</Text>
          <TextInput
            style={[layout.input, { minHeight: 100, textAlignVertical: 'top', marginBottom: 12 }]}
            multiline
            value={ingredientsText}
            onChangeText={setIngredientsText}
            editable={!busy}
          />

          <Text style={layout.label}>Steps (one per line)</Text>
          <TextInput
            style={[layout.input, { minHeight: 120, textAlignVertical: 'top', marginBottom: 12 }]}
            multiline
            value={stepsText}
            onChangeText={setStepsText}
            editable={!busy}
          />

          {commitLoading ? (
            <View
              style={[
                layout.card,
                {
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderColor: colors.accentMuted,
                },
              ]}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>Saving to library…</Text>
              </View>
              <Pressable onPress={cancelCommitRequest} hitSlop={8}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          {commitError ? (
            <View
              style={[
                layout.card,
                { marginBottom: 16, backgroundColor: colors.errorBg, borderColor: colors.errorText },
              ]}
            >
              <Text style={{ color: colors.errorText, fontWeight: '600' }}>{commitError}</Text>
              <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 20 }}>
                Nothing was saved to your library — your draft is still here. Fix any issues above, then tap Save
                again.
              </Text>
              <Pressable onPress={() => void runCommit()} style={{ marginTop: 10 }} disabled={busy}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Retry save</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <Pressable
              style={[layout.btnSecondary, { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' }]}
              onPress={confirmDiscardDraft}
              disabled={busy}
            >
              <Text style={layout.btnSecondaryText}>Cancel · discard draft</Text>
            </Pressable>
            <Pressable
              style={[layout.btn, { flex: 1, opacity: commitLoading ? 0.7 : 1 }]}
              onPress={() => void runCommit()}
              disabled={busy}
            >
              <Text style={layout.btnText}>Save to library</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
