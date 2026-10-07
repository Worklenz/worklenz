import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppVersion } from './env';

describe('getAppVersion', () => {
  beforeEach(() => {
    // Start every test from an explicit blank rather than relying on
    // unstubAllEnvs to restore import.meta.env: src/test/setup.ts replaces
    // process.env, which stops the restore from reaching import.meta.env.
    vi.stubEnv('VITE_APP_VERSION', '');
  });

  afterEach(() => {
    delete window.VITE_APP_VERSION;
    vi.unstubAllEnvs();
  });

  it('should return null when no version is configured', () => {
    expect(getAppVersion()).toBeNull();
  });

  it('should read the runtime-injected value (self-hosted env-config.js)', () => {
    window.VITE_APP_VERSION = '3.1.1';

    expect(getAppVersion()).toBe('3.1.1');
  });

  it('should fall back to the build-time env value', () => {
    vi.stubEnv('VITE_APP_VERSION', '2.9.0');

    expect(getAppVersion()).toBe('2.9.0');
  });

  it('should prefer the runtime value over the build-time one', () => {
    vi.stubEnv('VITE_APP_VERSION', '2.9.0');
    window.VITE_APP_VERSION = '3.1.1';

    expect(getAppVersion()).toBe('3.1.1');
  });

  it('should treat an empty or whitespace-only value as unset (the Docker default)', () => {
    window.VITE_APP_VERSION = '';
    expect(getAppVersion()).toBeNull();

    window.VITE_APP_VERSION = '   ';
    expect(getAppVersion()).toBeNull();
  });

  it('should trim surrounding whitespace', () => {
    window.VITE_APP_VERSION = '  3.1.1 ';

    expect(getAppVersion()).toBe('3.1.1');
  });
});
