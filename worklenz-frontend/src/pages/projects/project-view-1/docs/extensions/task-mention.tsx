import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { KeyboardEvent, useEffect, useState, useSyncExternalStore } from 'react';

import i18n from '@/i18n';
import { Tooltip } from '@/shared/antd-imports';

import { mentionStore } from '../mention-store';
import { decodeHtmlEntities } from '@/utils/html-entities';

const TaskMentionView = ({ node }: NodeViewProps) => {
  const mentions = useSyncExternalStore(mentionStore.subscribe, mentionStore.get, mentionStore.get);
  const [language, setLanguage] = useState(i18n.language);
  const id = String(node.attrs.id || '');
  const task = mentions.tasks[id];
  const unavailable = !task || task.unavailable;
  const unavailableLabel = i18n.t('project-view-docs:unavailableTask', {
    defaultValue: 'Unavailable task',
  });
  const label = unavailable
    ? unavailableLabel
    : [task.task_key, decodeHtmlEntities(task.name)].filter(Boolean).join(' ');

  useEffect(() => {
    const handleLanguageChange = (nextLanguage: string) => setLanguage(nextLanguage);
    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  void language;

  const handleOpen = () => {
    if (unavailable) return;
    mentionStore.openTask(id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleOpen();
  };

  return (
    <NodeViewWrapper as="span" className="docs-mention docs-mention-task">
      <Tooltip title={label} trigger={['hover', 'focus']} styles={{ body: { overflowWrap: 'anywhere' } }}>
        <button
          type="button"
          className={unavailable ? 'docs-mention-chip is-unavailable' : 'docs-mention-chip'}
          aria-label={label}
          disabled={unavailable}
          onClick={handleOpen}
          onKeyDown={handleKeyDown}
        >
          <span>{label}</span>
        </button>
      </Tooltip>
    </NodeViewWrapper>
  );
};

export const TaskMention = Node.create({
  name: 'taskMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-task-mention]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-task-mention': HTMLAttributes.id || '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskMentionView);
  },
});
