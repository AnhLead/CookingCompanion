import * as SecureStore from 'expo-secure-store';
import type { AuthTokens } from './types';

const ACCESS_KEY = 'cc.auth.accessToken';
const REFRESH_KEY = 'cc.auth.refreshToken';

export type TokenStore = {
  getTokens(): Promise<AuthTokens | null>;
  setTokens(tokens: AuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
};

const secureStore: TokenStore = {
  async getTokens() {
    const accessToken = (await SecureStore.getItemAsync(ACCESS_KEY))?.trim();
    const refreshToken = (await SecureStore.getItemAsync(REFRESH_KEY))?.trim();
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },
  async setTokens({ accessToken, refreshToken }) {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  },
  async clearTokens() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

let activeStore: TokenStore = secureStore;

/** Test hook: replace SecureStore with an in-memory store. */
export function setTokenStore(store: TokenStore): void {
  activeStore = store;
}

export function resetTokenStore(): void {
  activeStore = secureStore;
}

export function getTokenStore(): TokenStore {
  return activeStore;
}

export async function getStoredTokens(): Promise<AuthTokens | null> {
  return getTokenStore().getTokens();
}

export async function setStoredTokens(tokens: AuthTokens): Promise<void> {
  return getTokenStore().setTokens(tokens);
}

export async function clearStoredTokens(): Promise<void> {
  return getTokenStore().clearTokens();
}
