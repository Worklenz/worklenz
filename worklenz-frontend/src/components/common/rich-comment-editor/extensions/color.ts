import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    color: {
      setColor: (color: string) => ReturnType;
      unsetColor: () => ReturnType;
    };
  }
}

/**
 * TipTap mark extension providing text color formatting support.
 * Parses and renders span elements with inline color styles, and exposes setColor/unsetColor commands.
 */
export const ColorMark = Mark.create({
  name: 'textStyle',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: element => element.style?.color?.replace(/['"]+/g, '') || null,
        renderHTML: attributes => {
          if (!attributes.color) {
            return {};
          }
          return {
            style: `color: ${attributes.color}`,
          };
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: element => {
          const hasColor = (element as HTMLElement).style?.color;
          if (!hasColor) {
            return false;
          }
          return {};
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setColor:
        (color: string) =>
        ({ chain }) => {
          return chain().setMark(this.name, { color }).run();
        },
      unsetColor:
        () =>
        ({ chain }) => {
          return chain().unsetMark(this.name).run();
        },
    };
  },
});
