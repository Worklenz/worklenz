/**
 * Allocate a "Copy of …" name that avoids runaway "Copy of Copy of …" chains.
 * Mirrors worklenz-backend/src/shared/template-copy-name.ts (server is source of truth).
 */
export const stripCopyNameRoot = (name: string): string => {
  let root = (name || '').trim();
  if (!root) return 'Template';

  const trailingNumber = /\s+\(\d+\)$/;
  const copyPrefix = /^copy of\s+/i;

  let previous = '';
  while (root !== previous) {
    previous = root;
    root = root.replace(trailingNumber, '').trim();
    if (copyPrefix.test(root)) {
      root = root.replace(copyPrefix, '').trim();
    }
  }

  return root || 'Template';
};

export const allocateCopyName = (originalName: string, existingNames: string[]): string => {
  const root = stripCopyNameRoot(originalName);
  const existingLower = new Set(
    existingNames.map(n => (n || '').trim().toLowerCase()).filter(Boolean)
  );

  const first = `Copy of ${root}`;
  if (!existingLower.has(first.toLowerCase())) {
    return first;
  }

  let index = 2;
  while (existingLower.has(`Copy of ${root} (${index})`.toLowerCase())) {
    index += 1;
  }
  return `Copy of ${root} (${index})`;
};
