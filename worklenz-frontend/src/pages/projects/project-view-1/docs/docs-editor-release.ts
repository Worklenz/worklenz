import { flushSync } from 'react-dom';

const releasers = new Set<() => void>();

/** Registers a synchronous unmount of the docs editor. Returns an unsubscribe. */
export const registerDocsEditorRelease = (release: () => void) => {
  releasers.add(release);
  return () => {
    releasers.delete(release);
  };
};

/**
 * Unmounts the TipTap editor before a route change commits.
 * History updates immediately under `v7_startTransition`; tearing the editor
 * down inside that commit leaves the docs screen on screen.
 */
export const releaseDocsEditors = () => {
  if (releasers.size === 0) return;
  const pending = Array.from(releasers);
  flushSync(() => {
    pending.forEach(release => release());
  });
};
