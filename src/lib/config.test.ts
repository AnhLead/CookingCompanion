import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constantsMock = vi.hoisted(() => ({
  expoConfig: { extra: {} as Record<string, string | undefined> },
}));

vi.mock('expo-constants', () => ({
  default: constantsMock,
}));

import { assertReleaseApiConfig, getApiBaseUrl, getAppEnvironment } from './config';

describe('config', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    constantsMock.expoConfig = { extra: {} };
  });

  it('parses api base from extra and strips trailing slash', () => {
    constantsMock.expoConfig = {
      extra: { apiBase: 'https://api.example.com/', appEnv: 'development' },
    };
    expect(getApiBaseUrl()).toBe('https://api.example.com');
    expect(getAppEnvironment()).toBe('development');
  });

  it('treats unknown appEnv as development', () => {
    constantsMock.expoConfig = { extra: { apiBase: '', appEnv: 'staging' } };
    expect(getAppEnvironment()).toBe('development');
  });

  it('maps preview and production', () => {
    constantsMock.expoConfig = { extra: { appEnv: 'preview' } };
    expect(getAppEnvironment()).toBe('preview');
    constantsMock.expoConfig = { extra: { appEnv: 'PRODUCTION' } };
    expect(getAppEnvironment()).toBe('production');
  });

  it('assertReleaseApiConfig is a no-op when __DEV__ is unset (Node/tests)', () => {
    constantsMock.expoConfig = { extra: { appEnv: 'production', apiBase: '' } };
    expect(() => assertReleaseApiConfig()).not.toThrow();
  });

  it('assertReleaseApiConfig is a no-op in dev bundles', () => {
    vi.stubGlobal('__DEV__', true);
    constantsMock.expoConfig = { extra: { appEnv: 'production', apiBase: '' } };
    expect(() => assertReleaseApiConfig()).not.toThrow();
  });

  it('assertReleaseApiConfig throws in production release without API URL', () => {
    vi.stubGlobal('__DEV__', false);
    constantsMock.expoConfig = { extra: { appEnv: 'production', apiBase: '  ' } };
    expect(() => assertReleaseApiConfig()).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });

  it('assertReleaseApiConfig allows production when API URL is set', () => {
    vi.stubGlobal('__DEV__', false);
    constantsMock.expoConfig = {
      extra: { appEnv: 'production', apiBase: 'https://api.example.com' },
    };
    expect(() => assertReleaseApiConfig()).not.toThrow();
  });
});
