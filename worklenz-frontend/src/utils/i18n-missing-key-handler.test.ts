import { createInstance, type BackendModule, type ReadCallback } from 'i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMissingKeyHandler } from './i18n-missing-key-handler';

afterEach(() => vi.restoreAllMocks());

describe('missing translation warnings', () => {
  it('does not warn before initialization finishes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const instance = createInstance();

    createMissingKeyHandler(instance)([], 'settings/team-members', 'adminText');

    expect(warn).not.toHaveBeenCalled();
  });

  it('waits for an HTTP namespace and still reports genuinely missing keys', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const instance = createInstance();
    let finishRead: ReadCallback | undefined;
    const backend: BackendModule = {
      type: 'backend',
      init: () => {},
      read: (_language, namespace, callback) => {
        if (namespace === 'common') callback(null, {});
        else finishRead = callback;
      },
    };
    await instance.use(backend).init({
      lng: 'en',
      fallbackLng: 'en',
      ns: ['common'],
      saveMissing: true,
      missingKeyHandler: createMissingKeyHandler(instance),
    });

    const loading = instance.loadNamespaces('settings/import-export');
    expect(instance.hasLoadedNamespace('settings/import-export')).toBe(false);
    expect(instance.t('common.previous', {
      ns: 'settings/import-export', defaultValue: 'Previous',
    })).toBe('Previous');
    expect(warn).not.toHaveBeenCalled();

    expect(finishRead).toBeDefined();
    finishRead?.(null, { common: { previous: 'Previous' } });
    await loading;
    instance.t('common.previous', { ns: 'settings/import-export' });
    expect(warn).not.toHaveBeenCalled();

    instance.t('genuinelyMissing', { ns: 'settings/import-export' });
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '[i18n] Missing key "genuinelyMissing" in namespace "settings/import-export" for language(s): en'
    );
  });
});
