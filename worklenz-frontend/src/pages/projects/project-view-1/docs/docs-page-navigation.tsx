import { Breadcrumb, Button, Empty, Flex, Typography } from '@/shared/antd-imports';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IDocumentNode,
  IDocumentSection,
  IProjectDocumentSummary,
  ISectionDocument,
} from '@/types/project/project-documents.types';
import { mentionStore } from './mention-store';

export interface DocsHeading {
  id: string;
  level: number;
  content: IDocumentNode[];
}

export const documentHeadings = (content: ISectionDocument): DocsHeading[] => {
  const headings: DocsHeading[] = [];
  const visit = (sections: IDocumentSection[]) => {
    for (const section of sections) {
      if (section.type === 'heading')
        headings.push({ id: section.id, level: section.level || 1, content: section.content });
      if ('children' in section && section.children) visit(section.children);
      if ('items' in section) for (const item of section.items) visit(item.children || []);
    }
  };
  visit(content.sections);
  return headings;
};

export const documentAncestors = (
  pages: IProjectDocumentSummary[],
  id: string
): IProjectDocumentSummary[] => {
  const byId = new Map(pages.map(page => [page.id, page]));
  const seen = new Set([id]);
  const ancestors: IProjectDocumentSummary[] = [];
  let parentId = byId.get(id)?.parent_id;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parent_id;
  }
  return ancestors;
};

interface DocsBreadcrumbsProps {
  pages: IProjectDocumentSummary[];
  documentId: string;
  title: string;
  onSelect?: (id: string) => void;
}

export const DocsBreadcrumbs = ({ pages, documentId, title, onSelect }: DocsBreadcrumbsProps) => {
  const { t } = useTranslation('project-view-docs');
  const ancestors = useMemo(() => documentAncestors(pages, documentId), [pages, documentId]);
  return (
    <nav
      aria-label={t('pageBreadcrumbs', { defaultValue: 'Page breadcrumbs' })}
      className="docs-breadcrumbs"
    >
      <Breadcrumb
        items={[
          ...ancestors.map(page => ({
            key: page.id,
            title: (
              <button type="button" onClick={() => onSelect?.(page.id)} title={page.title}>
                {page.title}
              </button>
            ),
          })),
          {
            key: documentId,
            title: (
              <span aria-current="page" title={title}>
                {title || t('untitled', { defaultValue: 'Untitled' })}
              </span>
            ),
          },
        ]}
      />
    </nav>
  );
};

interface DocsOutlineProps {
  content: ISectionDocument;
  onSelect: (id: string) => void;
  onClose?: () => void;
}

export const DocsOutline = ({ content, onSelect, onClose }: DocsOutlineProps) => {
  const { t } = useTranslation('project-view-docs');
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigation = navigationRef.current;
    (navigation?.querySelector('button') || navigation)?.focus();
  }, []);
  const mentions = useSyncExternalStore(mentionStore.subscribe, mentionStore.get);
  const headings = useMemo(() => documentHeadings(content), [content]);
  const text = (nodes: IDocumentNode[]): string =>
    nodes
      .map(node => {
        if (node.type === 'memberMention')
          return `@${mentions.members[String(node.attrs?.id)]?.name || t('members', { defaultValue: 'Members' })}`;
        if (node.type === 'taskMention')
          return `#${mentions.tasks[String(node.attrs?.id)]?.name || t('tasks', { defaultValue: 'Tasks' })}`;
        if (node.type === 'hardBreak') return ' ';
        return node.text || (node.content ? text(node.content) : '');
      })
      .join('');
  return (
    <nav
      ref={navigationRef}
      tabIndex={-1}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose?.();
        }
      }}
      aria-label={t('documentOutline', { defaultValue: 'Document outline' })}
      className="docs-outline"
    >
      <Typography.Text type="secondary">
        {t('onThisPage', { defaultValue: 'On this page' })}
      </Typography.Text>
      {headings.length ? (
        <Flex vertical className="mt-2">
          {headings.map(heading => {
            const label =
              text(heading.content).trim() ||
              t('untitledHeading', { defaultValue: 'Untitled heading' });
            return (
              <Button
                type="text"
                key={heading.id}
                title={label}
                style={{ paddingInlineStart: 8 + (heading.level - 1) * 12 }}
                onClick={() => onSelect(heading.id)}
              >
                <span className="truncate">{label}</span>
              </Button>
            );
          })}
        </Flex>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('outlineEmpty', { defaultValue: 'Add headings to navigate this page.' })}
        />
      )}
    </nav>
  );
};
