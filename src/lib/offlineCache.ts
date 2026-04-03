import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecipeVariantDetail } from '../api/types';

const KEY = 'cc:lastVariants';
const MAX = 10;

export async function rememberVariant(v: RecipeVariantDetail): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: RecipeVariantDetail[] = raw ? JSON.parse(raw) : [];
    const next = [v, ...list.filter((x) => x.id !== v.id)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore cache failures
  }
}

export async function loadCachedVariant(id: string): Promise<RecipeVariantDetail | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const list: RecipeVariantDetail[] = JSON.parse(raw);
    return list.find((x) => x.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function listCachedVariants(): Promise<RecipeVariantDetail[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
