/**
 * CE stub — no in-app upgrade modal exists in the open-source build.
 */
export function useUpgradeModal(): { isOpen: boolean; close: () => void } {
  return { isOpen: false, close: () => {} };
}
