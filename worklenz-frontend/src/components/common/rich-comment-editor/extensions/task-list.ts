import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskList: {
      toggleTaskList: () => ReturnType;
    };
  }
}

/**
 * TipTap Node extension for task list containers (ul[data-type="taskList"]).
 * Handles list commands, keyboard shortcuts, and renders accessible checklist elements.
 */
export const TaskList = Node.create({
  name: 'taskList',
  group: 'block list',
  content: 'taskItem+',
  /** Recognizes unordered lists marked with data-type="taskList" as checklists. */
  parseHTML() {
    return [{ tag: 'ul[data-type="taskList"]', priority: 60 }];
  },
  /** Serializes a checklist as an unordered list with its taskList marker and class. */
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { 'data-type': 'taskList', class: 'rich-task-list' }), 0];
  },
  /** Provides a toggle that switches the current selection to or from a taskItem list. */
  addCommands() {
    return {
      toggleTaskList:
        () =>
        ({ commands }) => {
          return commands.toggleList(this.name, 'taskItem');
        },
    };
  },
  /** Binds Mod-Shift-9 to toggle the checklist for the current selection. */
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-9': () => this.editor.commands.toggleTaskList(),
    };
  },
});

/**
 * TipTap Node extension for individual checklist items (li[data-type="taskItem"]).
 * Renders checkbox inputs and content wrappers, and manages checked state transitions.
 */
export const TaskItem = Node.create({
  name: 'taskItem',
  content: 'paragraph block*',
  defining: true,
  /** Stores checked state in data-checked, defaulting to unchecked after a split. */
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
  /** Recognizes list items marked with data-type="taskItem" as checklist items. */
  parseHTML() {
    return [{ tag: 'li[data-type="taskItem"]', priority: 60 }];
  },
  /** Serializes checked state with a checkbox label and a separate content container. */
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
  /** Turns an empty bracket pair followed by a space into a checklist item. */
  addInputRules() {
    return [wrappingInputRule({ find: /^\s*\[\s?\]\s$/, type: this.type })];
  },
  /** Splits items with Enter, indents with Tab, and outdents with Shift-Tab. */
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    };
  },
  /**
   * Creates a checkbox view that updates document state when the editor is editable
   * and the item's position is available. Updates reuse the view only for taskItem nodes.
   */
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
