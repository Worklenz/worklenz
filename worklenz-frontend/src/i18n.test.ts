import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { readNamespace } = vi.hoisted(() => ({ readNamespace: vi.fn() }));

vi.mock('i18next-http-backend', () => ({
  default: class {
    static type = 'backend';
    type = 'backend';
    init() {}
    read(language: string, namespace: string, callback: (error: null, data: object) => void) {
      readNamespace(language, namespace);
      callback(null, {});
    }
  },
}));

describe('Taiwan i18next detection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('i18next', async importOriginal => {
      const original = await importOriginal<typeof import('i18next')>();
      return { ...original, default: original.createInstance() };
    });
    readNamespace.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['zh-TW', 'zh-Hant-TW', 'zh-Hant', 'zh_tw'])(
    'loads the zh_tw namespaces for %s',
    async language => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
      vi.spyOn(navigator, 'languages', 'get').mockReturnValue([language]);
      const { default: i18n } = await import('./i18n');
      if (!i18n.isInitialized) {
        await new Promise<void>(resolve => i18n.on('initialized', () => resolve()));
      }

      expect(i18n.language).toBe('zh_tw');
      expect(localStorage.getItem('i18nextLng')).toBe('zh_tw');
      expect(readNamespace).toHaveBeenCalledWith('zh_tw', 'common');
      expect(readNamespace).toHaveBeenCalledWith('zh_tw', 'task-drawer/task-drawer');
    }
  );
});
