import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { themeWiseColor } from '@/utils/themeWiseColor';

// Helper function to escape HTML
const escapeHtml = (text: string) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * URL regex — only matches http:// and https:// to prevent javascript: / data: schemes.
 * Kept outside the component so it is compiled once.
 */
const URL_REGEX = /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi;

export interface MentionOption {
  key: string;
  value: string;
  label: string;
}

interface CustomMentionsInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (option: MentionOption) => void;
  onSubmit?: () => void;
  themeMode: 'light' | 'dark';
  options: MentionOption[];
  placeholder?: string;
  autoFocus?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  filterOption?: (input: string, option: MentionOption) => boolean;
  style?: React.CSSProperties;
}

const CustomMentionsInput = ({
  value,
  onChange,
  onSelect,
  onSubmit,
  themeMode,
  options,
  placeholder,
  autoFocus,
  onClick,
  filterOption,
  style,
}: CustomMentionsInputProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<MentionOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  // Portal dropdown position — computed after layout settles
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  // Whether the dropdown opens above or below the input. Decided once per
  // open (not recomputed on every scroll/resize) so the direction doesn't
  // flip mid-session as the user filters — that flip was the original bug.
  const [dropdownShowAbove, setDropdownShowAbove] = useState(true);
  const editableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const isUpdatingRef = useRef(false);
  // Blocks the useEffect from rewriting the DOM on the onChange call that
  // immediately follows a Shift+Enter (the <br> is already in the DOM).
  const skipNextRenderRef = useRef(false);

  // Recompute the input's bounding rect whenever the dropdown opens, or on
  // scroll/resize. A single rAF gives the browser time to finish any layout
  // shift (e.g. the comment box expanding) before we read the rect.
  useEffect(() => {
    if (!isDropdownOpen) {
      setDropdownRect(null);
      return;
    }
    const dropdownMaxH = 200;
    let directionDecided = false;
    const compute = () => {
      if (!editableRef.current) return;
      const rect = editableRef.current.getBoundingClientRect();
      if (!directionDecided) {
        // Prefer showing above the input; if not enough space, show below.
        // Only decided the first time the dropdown opens, so subsequent
        // scroll/resize recomputes don't flip the direction mid-session.
        setDropdownShowAbove(rect.top >= dropdownMaxH + 8);
        directionDecided = true;
      }
      setDropdownRect(rect);
    };
    // rAF lets the expanded comment box finish painting before we measure
    const raf = requestAnimationFrame(compute);
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [isDropdownOpen]);

  /**
   * Builds the highlighted HTML shown inside the contentEditable div.
   * Handles both mention chips and URL highlights.
   */
  const createHighlightedHTML = (text: string) => {
    if (!text) return '';

    const mentionClass =
      themeMode === 'light' ? 'mention-highlight-light' : 'mention-highlight-dark';
    const urlClass = themeMode === 'light' ? 'url-highlight-light' : 'url-highlight-dark';

    type Range = { start: number; end: number; html: string };
    const ranges: Range[] = [];

    // Step 1: collect mention ranges
    for (const option of options) {
      const mentionText = `@${option.value}`;
      let startIndex = 0;

      while (startIndex < text.length) {
        const index = text.indexOf(mentionText, startIndex);
        if (index === -1) break;

        const beforeChar = index === 0 ? '' : text[index - 1];
        const afterChar =
          index + mentionText.length < text.length ? text[index + mentionText.length] : '';

        const isValidBefore = index === 0 || /[\s]/.test(beforeChar);
        // After the mention name there must be whitespace, end-of-string, or punctuation.
        // A word character (letter/digit/_) means the name runs into adjacent text — not a valid mention.
        const isValidAfter = afterChar === '' || /[\s.,;:!?)]/.test(afterChar);

        if (isValidBefore && isValidAfter) {
          const end = index + mentionText.length;
          if (!ranges.some(r => index >= r.start && index < r.end)) {
            ranges.push({
              start: index,
              end,
              html:
                `<span class="${mentionClass}" ` +
                `data-mention="true" ` +
                `data-mention-id="${option.key}" ` +
                `contenteditable="false"` +
                `>${escapeHtml(mentionText)}</span>`,
            });
          }
        }

        startIndex = index + 1;
      }
    }

    // Step 2: collect URL ranges
    URL_REGEX.lastIndex = 0;
    let urlMatch: RegExpExecArray | null;

    while ((urlMatch = URL_REGEX.exec(text)) !== null) {
      const start = urlMatch.index;
      const end = start + urlMatch[0].length;
      const rawUrl = urlMatch[0];

      const overlaps = ranges.some(r => start >= r.start && end <= r.end);
      if (!overlaps) {
        ranges.push({
          start,
          end,
          html:
            `<span class="${urlClass}" ` +
            `contenteditable="false" ` +
            `data-url="true"` +
            `>${escapeHtml(rawUrl)}</span>`,
        });
      }
    }

    // Step 3: sort by start position
    ranges.sort((a, b) => a.start - b.start);

    // Step 4: build final HTML
    // Escape plain text AND convert \n to <br> so newlines survive the
    // round-trip through the value string.
    const plainSegmentToHtml = (segment: string) =>
      escapeHtml(segment).replace(/\n/g, '<br>');

    let result = '';
    let cursor = 0;

    for (const range of ranges) {
      if (range.start > cursor) {
        result += plainSegmentToHtml(text.slice(cursor, range.start));
      }
      result += range.html;
      cursor = range.end;
    }

    if (cursor < text.length) {
      result += plainSegmentToHtml(text.slice(cursor));
    }

    return result;
  };

  const extractPlainText = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    let plainText = '';

    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        plainText += (node.textContent || '').replace(/\u200B/g, '');

      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName === 'BR') {
          plainText += '\n';
          return;
        }
        if (el.getAttribute('data-mention') === 'true' || el.getAttribute('data-url') === 'true') {
          // Use the trimmed text content so internal padding spaces don't leak into the value
          plainText += (node.textContent || '').replace(/\u200B/g, '');

        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            walkNodes(node.childNodes[i]);
          }
        }
      }
    };

    walkNodes(temp);
    return plainText;
  };

  const safelyAddRange = (selection: Selection, range: Range): boolean => {
    if (!selection || !range) return false;
    try {
      if (!range.startContainer || !range.endContainer) return false;
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer))
        return false;
      if (!editableRef.current || !document.contains(editableRef.current)) return false;
      if (
        !editableRef.current.contains(range.startContainer) ||
        !editableRef.current.contains(range.endContainer)
      )
        return false;
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (e) {
      return false;
    }
  };

  const getCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editableRef.current) return 0;

    try {
      const range = selection.getRangeAt(0);
      if (!range.startContainer || !range.endContainer) return 0;
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer))
        return 0;
    } catch (e) {
      return 0;
    }

    let length = 0;
    const walker = document.createTreeWalker(
      editableRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: node => {
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            if (
              el.getAttribute('data-mention') === 'true' ||
              el.getAttribute('data-url') === 'true'
            )
              return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      const endContainer = selection.getRangeAt(0).endContainer;
      if (currentNode === endContainer) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
          length += selection.getRangeAt(0).endOffset;
        } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
          length += currentNode.textContent?.length || 0;
        }
        break;
      }
      length += currentNode.textContent?.length || 0;
    }

    return length;
  };

  const isCursorInNonEditableSpan = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    try {
      const range = selection.getRangeAt(0);
      if (!range.startContainer || !range.endContainer) return false;
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer))
        return false;

      let node = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode!;

      while (node && node !== editableRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (
            el.getAttribute('data-mention') === 'true' ||
            el.getAttribute('data-url') === 'true'
          )
            return true;
        }
        node = node.parentNode!;
      }
    } catch (e) {
      return false;
    }

    return false;
  };

  const moveCursorAfterMentionWithSpace = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editableRef.current) return;

    try {
      const range = selection.getRangeAt(0);
      if (!range.startContainer || !range.endContainer) return;
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer))
        return;

      const mention =
        range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentNode
          : range.commonAncestorContainer;

      if (!mention || mention === editableRef.current || !document.contains(mention)) return;

      const newRange = document.createRange();
      const nextSibling = mention.nextSibling;

      if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
        const textContent = nextSibling.textContent || '';
        if (textContent.startsWith(' ')) {
          newRange.setStart(nextSibling, 1);
        } else {
          const space = document.createTextNode(' ');
          mention.parentNode?.insertBefore(space, nextSibling);
          newRange.setStart(space, 1);
        }
      } else {
        const space = document.createTextNode(' ');
        mention.parentNode?.insertBefore(space, mention.nextSibling);
        newRange.setStart(space, 1);
      }

      newRange.collapse(true);
      safelyAddRange(selection, newRange);
    } catch (e) {
      // ignore
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isComposingRef.current || isUpdatingRef.current) return;

    const plainText = extractPlainText(e.currentTarget.innerHTML);
    const currentCursorPos = getCursorPosition();
    setCursorPosition(currentCursorPos);

    if (plainText !== value) {
      onChange(plainText);
    }

    if (isCursorInNonEditableSpan()) {
      moveCursorAfterMentionWithSpace();
    }

    const textUpToCursor = plainText.slice(0, currentCursorPos);
    const lastAtIndex = textUpToCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const beforeAt = textUpToCursor.slice(0, lastAtIndex);
      const afterAt = textUpToCursor.slice(lastAtIndex);
      const charBeforeAt = beforeAt.slice(-1);

      if (
        !charBeforeAt ||
        /\s/.test(charBeforeAt) ||
        charBeforeAt === '\u00A0' ||
        /[.,;:!?()]/.test(charBeforeAt)
      ) {
        const textAfterAt = afterAt.slice(1);
        const spaceIndex = textAfterAt.indexOf(' ');

        if (spaceIndex === -1) {
          const filtered = options.filter((opt: MentionOption) =>
            filterOption ? filterOption(textAfterAt, opt) : true
          );

          setFilteredOptions(filtered);
          setIsDropdownOpen(filtered.length > 0);
          setSelectedIndex(0);
          return;
        }
      }
    }

    setIsDropdownOpen(false);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    isComposingRef.current = false;
    handleInput(e as unknown as React.FormEvent<HTMLDivElement>);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCursorInNonEditableSpan() && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      moveCursorAfterMentionWithSpace();

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        try {
          const range = selection.getRangeAt(0);
          if (!range.startContainer || !range.endContainer) return;
          if (!document.contains(range.startContainer) || !document.contains(range.endContainer))
            return;

          const textNode = document.createTextNode(e.key);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          safelyAddRange(selection, range);

          setTimeout(() => {
            if (editableRef.current) {
              editableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 0);
        } catch (err) {
          // ignore
        }
      }
      return;
    }

    if (isCursorInNonEditableSpan() && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      moveCursorAfterMentionWithSpace();
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        try {
          const range = selection.getRangeAt(0);
          if (!range.startContainer || !range.endContainer) return;
          if (!document.contains(range.startContainer) || !document.contains(range.endContainer))
            return;

          if (e.key === 'Backspace' && range.collapsed) {
            const previousNode = range.startContainer.childNodes[range.startOffset - 1];
            if (
              previousNode &&
              previousNode.nodeType === Node.ELEMENT_NODE &&
              ((previousNode as Element).getAttribute('data-mention') === 'true' ||
                (previousNode as Element).getAttribute('data-url') === 'true')
            ) {
              e.preventDefault();
              previousNode.remove();
              setTimeout(() => {
                if (editableRef.current) {
                  editableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }, 0);
              return;
            }
          }

          if (e.key === 'Delete' && range.collapsed) {
            const nextNode = range.startContainer.childNodes[range.startOffset];
            if (
              nextNode &&
              nextNode.nodeType === Node.ELEMENT_NODE &&
              ((nextNode as Element).getAttribute('data-mention') === 'true' ||
                (nextNode as Element).getAttribute('data-url') === 'true')
            ) {
              e.preventDefault();
              nextNode.remove();
              setTimeout(() => {
                if (editableRef.current) {
                  editableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }, 0);
              return;
            }
          }
        } catch (err) {
          // ignore
        }
      }
    }

    if (isDropdownOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredOptions.length > 0) {
        e.preventDefault();
        selectOption(filteredOptions[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsDropdownOpen(false);
      }
      return;
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        e.preventDefault();
        if (!editableRef.current) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const br = document.createElement('br');
        range.insertNode(br);

        // Insert a zero-width space after the <br> as a stable cursor anchor.
        // Without it the browser has nowhere to place the caret on the new
        // line and it snaps back to the line above. \u200B is stripped in
        // extractPlainText so it never leaks into the comment value.
        const anchor = document.createTextNode('\u200B');
        br.parentNode?.insertBefore(anchor, br.nextSibling);

        const newRange = document.createRange();
        newRange.setStart(anchor, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);


        // Prevent the useEffect from wiping the <br> the browser just inserted.
        skipNextRenderRef.current = true;

        const updated = extractPlainText(editableRef.current.innerHTML);
        onChange(updated);
      } else {
        e.preventDefault();
        if (value?.trim() && onSubmit) onSubmit();
      }
    }
  };

  const selectOption = (option: MentionOption) => {
    const plainText = value || '';
    const lastAtIndex = plainText.lastIndexOf('@', cursorPosition);

    if (lastAtIndex !== -1) {
      const beforeAt = plainText.slice(0, lastAtIndex);
      const afterCursor = plainText.slice(cursorPosition);
      const newText = beforeAt + '@' + option.value + ' ' + afterCursor;
      onChange(newText);
      if (onSelect) onSelect(option);
    }

    setIsDropdownOpen(false);

    setTimeout(() => {
      if (editableRef.current) {
        editableRef.current.focus();
        moveCursorAfterMentionWithSpace();
      }
    }, 10);
  };

  const restoreCursorPosition = (offset: number) => {
    const selection = window.getSelection();
    if (!selection || !editableRef.current) return;
    if (!document.contains(editableRef.current)) return;

    try {
      selection.removeAllRanges();
    } catch (e) {
      return;
    }

    const newRange = document.createRange();
    let currentPos = 0;
    let found = false;

    const walkNodes = (node: Node): boolean => {
      if (!document.contains(node)) return false;

      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        if (currentPos + textLength >= offset) {
          try {
            newRange.setStart(node, Math.min(offset - currentPos, textLength));
            newRange.collapse(true);
            found = true;
            return true;
          } catch (e) {
            return false;
          }
        }
        currentPos += textLength;
        return false;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.getAttribute('data-mention') === 'true' || el.getAttribute('data-url') === 'true') {
          const textLength = node.textContent?.length || 0;
          if (currentPos + textLength >= offset) {
            const nextSibling = node.nextSibling;
            try {
              if (
                nextSibling &&
                nextSibling.nodeType === Node.TEXT_NODE &&
                nextSibling.textContent?.startsWith(' ')
              ) {
                newRange.setStart(nextSibling, 1);
              } else {
                const spaceNode = document.createTextNode(' ');
                node.parentNode?.insertBefore(spaceNode, node.nextSibling);
                newRange.setStart(spaceNode, 1);
              }
              newRange.collapse(true);
              found = true;
              return true;
            } catch (e) {
              return false;
            }
          }
          currentPos += textLength;
          return false;
        }

        for (let i = 0; i < node.childNodes.length; i++) {
          if (walkNodes(node.childNodes[i])) return true;
        }
      }

      return false;
    };

    walkNodes(editableRef.current);

    try {
      if (found) {
        safelyAddRange(selection, newRange);
      } else {
        const lastNode = editableRef.current.lastChild;
        if (lastNode && document.contains(lastNode)) {
          if (lastNode.nodeType === Node.TEXT_NODE) {
            newRange.setStart(lastNode, lastNode.textContent?.length || 0);
          } else {
            newRange.setStartAfter(lastNode);
          }
          newRange.collapse(true);
          safelyAddRange(selection, newRange);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // Sync highlighted HTML when value / options / theme changes
  useEffect(() => {
    if (skipNextRenderRef.current) {
      skipNextRenderRef.current = false;
      return;
    }

    if (editableRef.current && value !== undefined && !isUpdatingRef.current) {
      isUpdatingRef.current = true;

      const highlighted = createHighlightedHTML(value);

      if (editableRef.current.innerHTML !== highlighted) {
        const selection = window.getSelection();
        const offset =
          selection && selection.rangeCount > 0 ? getCursorPosition() : value.length;

        editableRef.current.innerHTML = highlighted;

        if (editableRef.current.childNodes.length > 0 && offset >= 0) {
          restoreCursorPosition(offset);
        }
      }

      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [value, themeMode, options]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && editableRef.current) {
      editableRef.current.focus();
    }
  }, [autoFocus]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideDropdown = dropdownRef.current?.contains(target);
      const clickedInsideEditable = editableRef.current?.contains(target);
      if (!clickedInsideDropdown && !clickedInsideEditable) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent HTML paste — plain text only
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
    };
    const editable = editableRef.current;
    if (editable) {
      editable.addEventListener('paste', handlePaste);
      return () => editable.removeEventListener('paste', handlePaste);
    }
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) onClick(e);
    if (isCursorInNonEditableSpan()) {
      moveCursorAfterMentionWithSpace();
    }
  };

  return (
    <div className="custom-mentions-wrapper" style={{ position: 'relative' }}>
      <div
        ref={editableRef}
        contentEditable
        className={`custom-mentions-editable theme-${themeMode}`}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        data-placeholder={placeholder}
        style={{
          ...style,
          minHeight: style?.minHeight || 60,
          maxHeight: style?.maxHeight || 200,
          overflowY: 'auto',
          padding: '4px 11px',
          border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
          borderRadius: style?.borderRadius || 4,
          backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
          color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)', themeMode),
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          cursor: 'text',
        }}
      />

      {isDropdownOpen && filteredOptions.length > 0 && dropdownRect &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`mentions-dropdown theme-${themeMode}`}
            style={{
              // position: fixed so it escapes any overflow:hidden parent
              position: 'fixed',
              // Anchor above or below the input, decided once per open (see dropdownShowAbove)
              ...(dropdownShowAbove
                ? { bottom: window.innerHeight - dropdownRect.top + 4, top: 'unset' }
                : { top: dropdownRect.bottom + 4, bottom: 'unset' }),
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 99999,
              // Reset CSS class margins that would conflict
              marginTop: 0,
              marginBottom: 0,
              backgroundColor: themeWiseColor('#fff', '#1f1f1f', themeMode),
              color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)', themeMode),
              borderColor: themeWiseColor('#d9d9d9', '#434343', themeMode),
            }}
          >
            {filteredOptions.map((option, index) => (
              <div
                key={option.key}
                className={`mentions-option ${index === selectedIndex ? 'selected' : ''}`}
                onMouseDown={e => {
                  e.preventDefault();
                  selectOption(option);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{ padding: '8px 12px', cursor: 'pointer', transition: 'background-color 0.2s' }}
              >
                {option.label}
              </div>
            ))}
          </div>,
          document.body
        )
      }
    </div>
  );
};

export default CustomMentionsInput;
