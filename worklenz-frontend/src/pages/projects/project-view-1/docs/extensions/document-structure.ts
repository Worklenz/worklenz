import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';

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
];

/** v1 stores one paragraph per quote/item. Restrict the schema until v2 can persist nesting. */
export const DocumentStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() || []).map(extension =>
      ['blockquote', 'listItem'].includes(extension.name)
        ? extension.extend({ content: 'paragraph' })
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
    content: 'paragraph',
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
    addKeyboardShortcuts() {
      return {
        Enter: () => this.editor.commands.splitListItem(this.name),
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
