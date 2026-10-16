import {
  IProjectDocumentSummary,
  IReorderDocumentItem,
} from '@/types/project/project-documents.types';

export interface DocumentTreeNode extends IProjectDocumentSummary {
  children: DocumentTreeNode[];
}

export interface FlatDocument extends IProjectDocumentSummary {
  depth: number;
}

const MAX_DEPTH = 5;

export const buildDocumentTree = (pages: IProjectDocumentSummary[]): DocumentTreeNode[] => {
  const nodes = new Map<string, DocumentTreeNode>();
  pages.forEach(page => {
    nodes.set(page.id, { ...page, children: [] });
  });

  const roots: DocumentTreeNode[] = [];
  nodes.forEach(node => {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (list: DocumentTreeNode[]) => {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    list.forEach(node => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
};

export const flattenDocumentTree = (
  nodes: DocumentTreeNode[],
  depth = 1
): FlatDocument[] =>
  nodes.flatMap(node => [
    { ...node, depth },
    ...flattenDocumentTree(node.children, depth + 1),
  ]);

export const pageDepth = (pages: IProjectDocumentSummary[], id: string): number => {
  const byId = new Map(pages.map(page => [page.id, page]));
  let depth = 1;
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current?.parent_id && byId.has(current.parent_id) && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.parent_id);
  }
  return depth;
};

export const collectDescendantIds = (
  pages: IProjectDocumentSummary[],
  rootId: string
): Set<string> => {
  const children = new Map<string, string[]>();
  pages.forEach(page => {
    if (!page.parent_id) return;
    const list = children.get(page.parent_id) || [];
    list.push(page.id);
    children.set(page.parent_id, list);
  });

  const result = new Set<string>();
  const walk = (id: string) => {
    (children.get(id) || []).forEach(childId => {
      result.add(childId);
      walk(childId);
    });
  };
  walk(rootId);
  return result;
};

const subtreeHeight = (pages: IProjectDocumentSummary[], id: string): number => {
  const rootDepth = pageDepth(pages, id);
  let height = 1;
  collectDescendantIds(pages, id).forEach(descendantId => {
    height = Math.max(height, pageDepth(pages, descendantId) - rootDepth + 1);
  });
  return height;
};

export const planDocumentMove = (
  pages: IProjectDocumentSummary[],
  activeId: string,
  overId: string,
  placement: 'before' | 'after' | 'inside'
): IReorderDocumentItem[] | null => {
  if (activeId === overId) return null;
  const over = pages.find(page => page.id === overId);
  const active = pages.find(page => page.id === activeId);
  if (!over || !active) return null;

  const descendants = collectDescendantIds(pages, activeId);
  const newParentId = placement === 'inside' ? over.id : over.parent_id;
  if (newParentId && (newParentId === activeId || descendants.has(newParentId))) {
    return null;
  }

  const parentDepth = newParentId ? pageDepth(pages, newParentId) : 0;
  if (parentDepth + subtreeHeight(pages, activeId) > MAX_DEPTH) {
    return null;
  }

  const next = pages.map(page =>
    page.id === activeId ? { ...page, parent_id: newParentId } : { ...page }
  );
  const groups = new Map<string, IProjectDocumentSummary[]>();
  next.forEach(page => {
    if (page.id === activeId) return;
    const key = page.parent_id || '';
    const list = groups.get(key) || [];
    list.push(page);
    groups.set(key, list);
  });

  const targetKey = newParentId || '';
  const siblings = (groups.get(targetKey) || []).sort(
    (a, b) => a.position - b.position || a.title.localeCompare(b.title)
  );
  const overIndex = siblings.findIndex(page => page.id === overId);
  let insertAt = siblings.length;
  if (placement === 'inside') {
    insertAt = siblings.length;
  } else if (overIndex >= 0) {
    insertAt = placement === 'before' ? overIndex : overIndex + 1;
  }
  siblings.splice(insertAt, 0, next.find(page => page.id === activeId) as IProjectDocumentSummary);
  groups.set(targetKey, siblings);

  const items: IReorderDocumentItem[] = [];
  groups.forEach((group, key) => {
    const ordered =
      key === targetKey
        ? group
        : [...group].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    ordered.forEach((page, index) => {
      items.push({
        id: page.id,
        parent_id: key || null,
        position: index,
      });
    });
  });

  return items;
};
