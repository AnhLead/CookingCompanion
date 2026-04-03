import { useState } from 'react';
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
import { ApiError, importCommit, importPreview, isRetriableClientFailure } from '../../src/api/client';
import type { ImportPreviewResponse, IngredientLine, RecipeStep } from '../../src/api/types';
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
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [dishName, setDishName] = useState('');
  const [title, setTitle] = useState('');
  const [yields, setYields] = useState('');
  const [totalTimeMin, setTotalTimeMin] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

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

  const runPreview = async () => {
    setPreviewError(null);
    setBusy(true);
    try {
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
      const res = await importPreview(body);
      applyPreview(res);
    } catch (e) {
      const msg =
        e instanceof ApiError ? `${e.message}${e.status ? ` (${e.status})` : ''}` : e instanceof Error ? e.message : 'Unknown error';
      const hint = isRetriableClientFailure(e) ? ' Check your connection and try again.' : '';
      setPreviewError(`${msg}${hint}`);
    } finally {
      setBusy(false);
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
    setBusy(true);
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

      const { variantId } = await importCommit({
        dishName: dishName.trim(),
        variant,
      });
      router.replace(`/variant/${variantId}`);
    } catch (e) {
      const msg =
        e instanceof ApiError ? `${e.message}${e.status ? ` (${e.status})` : ''}` : e instanceof Error ? e.message : 'Unknown error';
      const hint = isRetriableClientFailure(e) ? ' You can retry save.' : '';
      setCommitError(`${msg}${hint}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={layout.screen} contentContainerStyle={[layout.pad, { paddingBottom: 40 }]}>
      <Text style={layout.title}>Import</Text>
      <Text style={layout.subtitle}>
        Paste a recipe URL or raw HTML. Preview fills a draft; edit, then save (commit).
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
      />

      <Text style={layout.label}>Or paste HTML / text</Text>
      <TextInput
        style={[layout.input, { minHeight: 120, textAlignVertical: 'top' }]}
        placeholder="Optional: paste page HTML or rough text"
        placeholderTextColor={colors.muted}
        multiline
        value={html}
        onChangeText={setHtml}
      />

      <Pressable style={[layout.btn, { marginTop: 8 }]} onPress={() => void runPreview()} disabled={busy}>
        {busy && !preview ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={layout.btnText}>Preview</Text>
        )}
      </Pressable>

      {previewError ? (
        <View
          style={[
            layout.card,
            { marginTop: 16, backgroundColor: colors.errorBg, borderColor: colors.errorText },
          ]}
        >
          <Text style={{ color: colors.errorText, fontWeight: '600' }}>{previewError}</Text>
          <Pressable onPress={() => void runPreview()} style={{ marginTop: 10 }}>
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
          <TextInput style={[layout.input, { marginBottom: 12 }]} value={dishName} onChangeText={setDishName} />

          <Text style={layout.label}>Variant title</Text>
          <TextInput style={[layout.input, { marginBottom: 12 }]} value={title} onChangeText={setTitle} />

          <Text style={layout.label}>Yields (optional)</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="e.g. 4 servings"
            placeholderTextColor={colors.muted}
            value={yields}
            onChangeText={setYields}
          />

          <Text style={layout.label}>Total time, minutes (optional)</Text>
          <TextInput
            style={[layout.input, { marginBottom: 12 }]}
            placeholder="e.g. 45"
            placeholderTextColor={colors.muted}
            value={totalTimeMin}
            onChangeText={setTotalTimeMin}
            keyboardType="number-pad"
          />

          <Text style={layout.label}>Ingredients (one per line)</Text>
          <TextInput
            style={[layout.input, { minHeight: 100, textAlignVertical: 'top', marginBottom: 12 }]}
            multiline
            value={ingredientsText}
            onChangeText={setIngredientsText}
          />

          <Text style={layout.label}>Steps (one per line)</Text>
          <TextInput
            style={[layout.input, { minHeight: 120, textAlignVertical: 'top', marginBottom: 12 }]}
            multiline
            value={stepsText}
            onChangeText={setStepsText}
          />

          {commitError ? (
            <View
              style={[
                layout.card,
                { marginBottom: 16, backgroundColor: colors.errorBg, borderColor: colors.errorText },
              ]}
            >
              <Text style={{ color: colors.errorText, fontWeight: '600' }}>{commitError}</Text>
              <Pressable onPress={() => void runCommit()} style={{ marginTop: 10 }}>
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
            <Pressable style={[layout.btn, { flex: 1 }]} onPress={() => void runCommit()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={layout.btnText}>Save to library</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
