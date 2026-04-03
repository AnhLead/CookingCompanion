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
import { importCommit, importPreview } from '../../src/api/client';
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

export default function ImportScreen() {
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [dishName, setDishName] = useState('');
  const [title, setTitle] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [busy, setBusy] = useState(false);

  const applyPreview = (p: ImportPreviewResponse) => {
    setPreview(p);
    const d = p.draft;
    setDishName(d.dishName ?? '');
    setTitle(d.title ?? '');
    setIngredientsText((d.ingredients ?? []).map((i) => i.text).join('\n'));
    setStepsText((d.steps ?? []).sort((a, b) => a.order - b.order).map((s) => s.text).join('\n'));
  };

  const runPreview = async () => {
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
      Alert.alert('Preview failed', e instanceof Error ? e.message : 'Unknown error');
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
    setBusy(true);
    try {
      const { dishId, variantId } = await importCommit({
        dishName: dishName.trim(),
        variant: {
          title: title.trim(),
          ingredients,
          steps,
          source: preview?.draft.source ?? {
            type: url ? 'web' : 'manual',
            url: url.trim() || null,
            attribution: url.trim() || 'manual import',
          },
        },
      });
      router.replace(`/variant/${variantId}`);
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unknown error');
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
          <Text style={[layout.title, { fontSize: 20, marginTop: 24 }]}>Edit draft</Text>

          <Text style={layout.label}>Dish name</Text>
          <TextInput style={[layout.input, { marginBottom: 12 }]} value={dishName} onChangeText={setDishName} />

          <Text style={layout.label}>Variant title</Text>
          <TextInput style={[layout.input, { marginBottom: 12 }]} value={title} onChangeText={setTitle} />

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

          <Pressable style={layout.btn} onPress={() => void runCommit()} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={layout.btnText}>Save to library</Text>}
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}
