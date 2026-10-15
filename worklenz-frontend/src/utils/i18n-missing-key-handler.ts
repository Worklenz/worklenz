import type { i18n } from 'i18next';

/** Report missing keys only after initialization and namespace loading finish. */
export const createMissingKeyHandler = (
  instance: Pick<i18n, 'isInitialized' | 'hasLoadedNamespace'>
) => (languages: readonly string[], namespace: string, key: string) => {
  // useSuspense is disabled, so components can translate before their HTTP
  // resources arrive. Match i18next's built-in saveMissing loading guard.
  if (!instance.isInitialized || !instance.hasLoadedNamespace(namespace)) return;

  console.warn(
    `[i18n] Missing key "${key}" in namespace "${namespace}" for language(s): ${languages.join(', ')}`
  );
};
