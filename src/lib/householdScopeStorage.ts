import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cookingcompanion.activeHouseholdId';

export async function loadPersistedHouseholdId(): Promise<string | null> {
  const v = await AsyncStorage.getItem(KEY);
  if (v == null || v.trim() === '') return null;
  return v.trim();
}

export async function persistHouseholdId(id: string | null): Promise<void> {
  if (id == null || id.trim() === '') {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, id.trim());
}
