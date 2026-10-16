import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import i18n from '@/i18n';

import { mentionStore } from '../mention-store';

const MemberMentionView = ({ node }: NodeViewProps) => {
  const mentions = useSyncExternalStore(mentionStore.subscribe, mentionStore.get, mentionStore.get);
  const [language, setLanguage] = useState(i18n.language);
  const id = String(node.attrs.id || '');
  const member = mentions.members[id];
  const unavailable = !member || member.unavailable;
  const unavailableLabel = i18n.t('project-view-docs:unavailableMember', {
    defaultValue: 'Unavailable member',
  });
  const label = unavailable ? unavailableLabel : `@${member.name || ''}`;

  useEffect(() => {
    const handleLanguageChange = (nextLanguage: string) => setLanguage(nextLanguage);
    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  void language;

  return (
    <NodeViewWrapper as="span" className="docs-mention docs-mention-member">
      <span
        className={unavailable ? 'docs-mention-chip is-unavailable' : 'docs-mention-chip'}
        title={label}
        aria-label={label}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
};

export const MemberMention = Node.create({
  name: 'memberMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-member-mention]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-member-mention': HTMLAttributes.id || '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MemberMentionView);
  },
});
