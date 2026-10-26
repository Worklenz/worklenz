import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskList: {
      toggleTaskList: () => ReturnType;
    };
  }
}

export const TaskList = Node.create({
  name: 'taskList',
  group: 'block list',
  content: 'taskItem+',
  parseHTML() {
    return [{ tag: 'ul[data-type="taskList"]', priority: 60 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { 'data-type': 'taskList', class: 'rich-task-list' }), 0];
  },
  addCommands() {
    return {
      toggleTaskList:
        () =>
        ({ commands }) => {
          return commands.toggleList(this.name, 'taskItem');
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-9': () => this.editor.commands.toggleTaskList(),
    };
  },
});

export const TaskItem = Node.create({
  name: 'taskItem',
  content: 'paragraph block*',
  defining: true,
  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: element => element.getAttribute('data-checked') === 'true',
        renderHTML: attrs => ({ 'data-checked': attrs.checked ? 'true' : 'false' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'li[data-type="taskItem"]', priority: 60 }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'taskItem',
        'data-checked': node.attrs.checked ? 'true' : 'false',
        class: `rich-task-item ${node.attrs.checked ? 'is-checked' : ''}`,
      }),
      [
        'label',
        { contenteditable: 'false' },
        [
          'input',
          {
            type: 'checkbox',
            ...(node.attrs.checked ? { checked: 'checked' } : {}),
          },
        ],
      ],
      ['div', { class: 'rich-task-item-content' }, 0],
    ];
  },
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
      dom.className = `rich-task-item ${node.attrs.checked ? 'is-checked' : ''}`;
      dom.dataset.checked = String(node.attrs.checked === true);

      const label = document.createElement('label');
      label.contentEditable = 'false';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = node.attrs.checked === true;
      label.append(input);

      const contentDOM = document.createElement('div');
      contentDOM.className = 'rich-task-item-content';
      dom.append(label, contentDOM);

      input.addEventListener('change', () => {
        const position = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof position !== 'number' || !editor.isEditable) return;
        const current = editor.state.doc.nodeAt(position);
        if (current) {
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(position, undefined, {
              ...current.attrs,
              checked: input.checked,
            })
          );
        }
      });

      return {
        dom,
        contentDOM,
        update: next => {
          if (next.type.name !== 'taskItem') return false;
          input.checked = next.attrs.checked === true;
          dom.dataset.checked = String(next.attrs.checked === true);
          if (next.attrs.checked) {
            dom.classList.add('is-checked');
          } else {
            dom.classList.remove('is-checked');
          }
          return true;
        },
      };
    };
  },
});
