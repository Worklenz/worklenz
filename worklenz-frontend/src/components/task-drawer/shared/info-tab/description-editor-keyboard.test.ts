import Quill from 'quill';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMentionEnterBinding } from './description-editor-keyboard';

const rangeRectDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
const rangeClientRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');

describe('description editor Quill keyboard bindings', () => {
  let editorElement: HTMLDivElement;
  let quill: Quill;

  const createEditor = (
    getSelectedMention: () => string | undefined,
    insertMention: (mention: string) => void,
    isMentionActive = true
  ) => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    });
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    });
    editorElement = document.createElement('div');
    document.body.appendChild(editorElement);
    quill = new Quill(editorElement, {
      modules: {
        toolbar: false,
        keyboard: {
          bindings: {
            mentionEnter: createMentionEnterBinding(
              () => isMentionActive,
              getSelectedMention,
              insertMention
            ),
          },
        },
      },
    });
    quill.setText('@Ali');
    quill.setSelection(4);
    quill.focus();
  };

  const pressEnter = (isComposing = false) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing,
    });
    quill.root.dispatchEvent(event);
    return event;
  };

  afterEach(() => {
    quill?.disable();
    editorElement?.remove();
    if (rangeRectDescriptor) {
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', rangeRectDescriptor);
    } else {
      delete (Range.prototype as Partial<Range>).getBoundingClientRect;
    }
    if (rangeClientRectsDescriptor) {
      Object.defineProperty(Range.prototype, 'getClientRects', rangeClientRectsDescriptor);
    } else {
      delete (Range.prototype as Partial<Range>).getClientRects;
    }
  });

  it('inserts a selected mention before Quill applies its default Enter behavior', () => {
    const insertSelectedMention = vi.fn((mention: string) => {
      quill.deleteText(0, 4);
      quill.insertText(0, mention);
      quill.setSelection(mention.length);
    });
    createEditor(() => 'Alice Example', insertSelectedMention);

    const event = pressEnter();

    expect(insertSelectedMention).toHaveBeenCalledWith('Alice Example');
    expect(quill.getText()).toBe('Alice Example\n');
    expect(event.defaultPrevented).toBe(true);
  });

  it('allows Quill default Enter behavior when no suggestion is selected', () => {
    const insertSelectedMention = vi.fn();
    createEditor(() => undefined, insertSelectedMention);

    pressEnter();

    expect(insertSelectedMention).not.toHaveBeenCalled();
    expect(quill.getText()).toBe('@Ali\n\n');
  });

  it('does not insert a mention while Quill is composing text', () => {
    const insertSelectedMention = vi.fn();
    createEditor(() => 'Alice Example', insertSelectedMention);

    const event = pressEnter(true);

    expect(insertSelectedMention).not.toHaveBeenCalled();
    expect(quill.getText()).toBe('@Ali\n');
    expect(event.defaultPrevented).toBe(false);
  });
});
