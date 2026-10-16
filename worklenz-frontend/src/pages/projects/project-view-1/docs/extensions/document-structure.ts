import { Extension, Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

// Match the backend's content nesting limit so Tab cannot create an unsavable tree.
const MAX_CONTENT_NESTING = 20;
const supportsNesting = (node: ProseMirrorNode, depth = 0): boolean => {
  if (depth > MAX_CONTENT_NESTING) return false;
  let supported = true;
  if (['bulletList', 'orderedList', 'taskList'].includes(node.type.name)) {
    node.forEach(item =>
      item.forEach((child, _offset, index) => {
        if (index > 0 && !supportsNesting(child, depth + 1)) supported = false;
      })
    );
  } else if (node.type.name === 'blockquote' || node.type.name === 'callout') {
    node.forEach((child, _offset, index) => {
      if (index > 0 && !supportsNesting(child, depth + 1)) supported = false;
    });
  }
  return supported;
};

const IDENTIFIED_NODES = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'callout',
];

/** Containers begin with a paragraph; v2 persists subsequent blocks and nested lists. */
export const DocumentStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() || []).map(extension =>
      extension.name === 'blockquote'
        ? extension.extend({ content: 'paragraph block*' })
        : extension
    );
  },
});

export const DocumentStructure = Extension.create({
  name: 'documentStructure',
  addGlobalAttributes() {
    return [
      {
        types: IDENTIFIED_NODES,
        attributes: {
          id: {
            default: null,
            parseHTML: () => null,
            renderHTML: attributes => (attributes.id ? { 'data-block-id': attributes.id } : {}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction: transaction => {
          let supported = true;
          if (transaction.docChanged)
            transaction.doc.forEach(node => {
              if (!supportsNesting(node)) supported = false;
            });
          return supported;
        },
        appendTransaction: (transactions, _oldState, state) => {
          if (!transactions.some(transaction => transaction.docChanged)) return null;
          const ids = new Set<string>();
          const transaction = state.tr;
          state.doc.descendants((node, position) => {
            if (!IDENTIFIED_NODES.includes(node.type.name)) return;
            const id: unknown = node.attrs.id;
            if (typeof id === 'string' && id && !ids.has(id)) ids.add(id);
            else {
              const nextId = crypto.randomUUID();
              ids.add(nextId);
              transaction.setNodeMarkup(position, undefined, { ...node.attrs, id: nextId });
            }
          });
          return transaction.docChanged ? transaction : null;
        },
      }),
    ];
  },
});

export const DocumentTaskList = Node.create({
  name: 'taskList',
  group: 'block list',
  content: 'taskItem+',
  parseHTML: () => [{ tag: 'ul[data-type="taskList"]', priority: 60 }],
  renderHTML: ({ HTMLAttributes }) => [
    'ul',
    mergeAttributes(HTMLAttributes, { 'data-type': 'taskList' }),
    0,
  ],
});

export const createDocumentTaskItem = (checkboxLabel: string) =>
  Node.create({
    name: 'taskItem',
    content: 'paragraph block*',
    defining: true,
    addAttributes: () => ({
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: element => element.getAttribute('data-checked') === 'true',
        renderHTML: attrs => ({ 'data-checked': attrs.checked }),
      },
    }),
    parseHTML: () => [{ tag: 'li[data-type="taskItem"]', priority: 60 }],
    renderHTML: ({ node, HTMLAttributes }) => [
      'li',
      mergeAttributes(HTMLAttributes, { 'data-type': 'taskItem' }),
      [
        'label',
        { contenteditable: 'false' },
        [
          'input',
          {
            type: 'checkbox',
            'aria-label': checkboxLabel,
            ...(node.attrs.checked ? { checked: 'checked' } : {}),
          },
        ],
      ],
      ['div', {}, 0],
    ],
    addInputRules() {
      return [wrappingInputRule({ find: /^\s*\[\s?\]\s$/, type: this.type })];
    },
    addKeyboardShortcuts() {
      return {
        Enter: () => this.editor.commands.splitListItem(this.name),
        Tab: () => this.editor.commands.sinkListItem(this.name),
        'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
      };
    },
    addNodeView() {
      return ({ node, editor, getPos }) => {
        const dom = document.createElement('li');
        dom.dataset.type = 'taskItem';
        const label = document.createElement('label');
        label.contentEditable = 'false';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('aria-label', checkboxLabel);
        input.checked = node.attrs.checked === true;
        dom.dataset.checked = String(input.checked);
        label.append(input);
        const contentDOM = document.createElement('div');
        dom.append(label, contentDOM);
        input.addEventListener('change', () => {
          const position = getPos();
          if (typeof position !== 'number' || !editor.isEditable) return;
          const current = editor.state.doc.nodeAt(position);
          if (current)
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(position, undefined, {
                ...current.attrs,
                checked: input.checked,
              })
            );
        });
        return {
          dom,
          contentDOM,
          update: next => {
            if (next.type.name !== 'taskItem') return false;
            input.checked = next.attrs.checked === true;
            dom.dataset.checked = String(input.checked);
            return true;
          },
          stopEvent: event => event.target === input,
          ignoreMutation: mutation =>
            mutation.type !== 'selection' &&
            (mutation.target === label ||
              label.contains(mutation.target) ||
              mutation.target === dom),
        };
      };
    },
  });

export const DocumentCallout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph block*',
  defining: true,
  parseHTML: () => [{ tag: 'aside[data-type="callout"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'aside',
    mergeAttributes(HTMLAttributes, { 'data-type': 'callout', class: 'docs-callout' }),
    0,
  ],
});
