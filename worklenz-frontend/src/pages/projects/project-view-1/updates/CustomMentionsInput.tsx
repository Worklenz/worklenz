import React, { useState, useRef, useEffect, useCallback } from 'react';
import { themeWiseColor } from '@/utils/themeWiseColor';
import './project-view-updates.css';

// Helper function to escape HTML
const escapeHtml = (text: string) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const CustomMentionsInput = ({
  value,
  onChange,
  onSelect,
  themeMode,
  options,
  placeholder,
  autoFocus,
  onClick,
  prefix = '@',
  filterOption,
  style,
  onKeyDown,
  ...props
}: any) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const editableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const isUpdatingRef = useRef(false);

  // Guard selection mutations because contentEditable updates can detach range nodes.
  const safelyAddRange = (selection: Selection, range: Range): boolean => {
    if (!selection || !range || !editableRef.current) return false;

    try {
      if (!range.startContainer || !range.endContainer) return false;

      if (!document.contains(editableRef.current)) return false;
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
        return false;
      }

      if (
        !editableRef.current.contains(range.startContainer) ||
        !editableRef.current.contains(range.endContainer)
      ) {
        return false;
      }

      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Process text to create HTML with highlighted mentions
  const createHighlightedHTML = (text: string) => {
    if (!text) return '';

    const highlightClass =
      themeMode === 'light' ? 'mention-highlight-light' : 'mention-highlight-dark';

    // First, identify all mentions in the text
    const mentions: Array<{ start: number; end: number; text: string; option: any }> = [];

    // Find all @mentions that match options
    for (const option of options) {
      const mentionText = `@${option.value}`;
      let startIndex = 0;

      while (startIndex < text.length) {
        const index = text.indexOf(mentionText, startIndex);
        if (index === -1) break;

        // Check if it's a valid mention (preceded by whitespace or start of string, followed by whitespace or end)
        const beforeChar = index === 0 ? '' : text[index - 1];
        const afterChar =
          index + mentionText.length < text.length ? text[index + mentionText.length] : '';

        const isValidBefore = index === 0 || /\s/.test(beforeChar);
        const isValidAfter = afterChar === '' || /\s/.test(afterChar) || afterChar === ',';

        if (isValidBefore && isValidAfter) {
          // Also check that we're not matching part of a longer word
          const endIndex = index + mentionText.length;
          if (!mentions.some(m => index >= m.start && index < m.end)) {
            mentions.push({
              start: index,
              end: endIndex,
              text: mentionText,
              option,
            });
          }
        }

        startIndex = index + 1;
      }
    }

    // Sort mentions by start position (descending) so we can replace from end to beginning
    mentions.sort((a, b) => b.start - a.start);

    // Build the HTML string
    let result = escapeHtml(text);

    // Replace each mention with highlighted HTML
    for (const mention of mentions) {
      const before = result.slice(0, mention.start);
      const after = result.slice(mention.end);
      const mentionHtml = `<span class="${highlightClass}" data-mention="true" data-mention-id="${mention.option.key}" contenteditable="false">${escapeHtml(mention.text)}</span>`;
      result = before + mentionHtml + after;
    }

    return result;
  };

  // Extract plain text from HTML
  const extractPlainText = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Walk through nodes and build plain text
    let plainText = '';

    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        plainText += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if ((node as Element).getAttribute('data-mention') === 'true') {
          plainText += node.textContent || '';
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

  // Get cursor position that respects mention boundaries
  const getCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editableRef.current) return 0;

    let range;
    try {
      range = selection.getRangeAt(0);
      if (!range.startContainer || !range.endContainer) return 0;
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
        return 0;
      }
    } catch (e) {
      return 0;
    }

    // Walk through nodes to count text length
    let length = 0;
    const walker = document.createTreeWalker(
      editableRef.current!,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: node => {
          if (node.nodeType === Node.TEXT_NODE) {
            return NodeFilter.FILTER_ACCEPT;
          }
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).getAttribute('data-mention') === 'true'
          ) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === range.endContainer) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
          length += range.endOffset;
        } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
          // If inside a mention, count the full mention
          length += currentNode.textContent?.length || 0;
        }
        break;
      }
      if (currentNode.nodeType === Node.TEXT_NODE) {
        length += currentNode.textContent?.length || 0;
      } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
        length += currentNode.textContent?.length || 0;
      }
    }

    return length;
  };

  // Check if cursor is inside a mention
  const isCursorInMention = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    let range;
    try {
      range = selection.getRangeAt(0);
      if (!range.startContainer || !range.endContainer) return false;
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
        return false;
      }
    } catch (e) {
      return false;
    }

    let node = range.commonAncestorContainer;

    // If it's a text node, check its parent
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode!;
    }

    // Check if node or any parent is a mention
    while (node && node !== editableRef.current) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).getAttribute('data-mention') === 'true'
      ) {
        return true;
      }
      node = node.parentNode!;
    }

    return false;
  };

  // Move cursor after mention with a space
  const moveCursorAfterMentionWithSpace = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editableRef.current) return;

    let range;
    try {
      range = selection.getRangeAt(0);
      if (!range.startContainer || !range.endContainer) return;
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
        return;
      }
    } catch (e) {
      return;
    }

    const mention =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;

    if (!mention || mention === editableRef.current) return;

    const newRange = document.createRange();

    // Check if there's already a space after the mention
    let nextSibling = mention.nextSibling;

    if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      const textContent = nextSibling.textContent || '';

      // If the text node starts with a space, move cursor after it
      if (textContent.startsWith(' ')) {
        newRange.setStart(nextSibling, 1);
      } else {
        // Insert a space at the beginning of the text node
        const space = document.createTextNode(' ');
        mention.parentNode?.insertBefore(space, nextSibling);
        newRange.setStart(space, 1);
      }
    } else {
      // Create a space text node after the mention
      const space = document.createTextNode(' ');
      mention.parentNode?.insertBefore(space, mention.nextSibling);
      newRange.setStart(space, 1);
    }

    newRange.collapse(true);
    safelyAddRange(selection, newRange);
  };

  // Handle input changes - MODIFIED TO FIX BUG
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isComposingRef.current || isUpdatingRef.current) return;

    const plainText = extractPlainText(e.currentTarget.innerHTML);
    const currentCursorPos = getCursorPosition();
    setCursorPosition(currentCursorPos);

    // Update the value
    if (plainText !== value) {
      onChange(plainText);
    }

    // Check if cursor is inside a mention
    if (isCursorInMention()) {
      moveCursorAfterMentionWithSpace();
    }

    // Check if user is typing a mention
    const textUpToCursor = plainText.slice(0, currentCursorPos);
    const lastAtIndex = textUpToCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if @ is part of a completed mention
      const beforeAt = textUpToCursor.slice(0, lastAtIndex);
      const afterAt = textUpToCursor.slice(lastAtIndex);

      // Don't trigger mention if @ is in the middle of a word
      const charBeforeAt = beforeAt.slice(-1);
      if (
        !charBeforeAt ||
        /\s/.test(charBeforeAt) ||
        charBeforeAt === '\u00A0' ||
        /[.,;:!?()]/.test(charBeforeAt)
      ) {
        const textAfterAt = afterAt.slice(1); // Remove @
        const spaceOrSpecialCharIndex = textAfterAt.search(/[\s,;:!?()]/);

        // If there's no space/special char yet, or we're still before it, show dropdown
        if (
          spaceOrSpecialCharIndex === -1 ||
          currentCursorPos <= lastAtIndex + 1 + spaceOrSpecialCharIndex
        ) {
          const searchText =
            spaceOrSpecialCharIndex === -1
              ? textAfterAt
              : textAfterAt.slice(0, spaceOrSpecialCharIndex);

          const filtered = options.filter((opt: any) => {
            if (filterOption) {
              return filterOption(searchText.toLowerCase(), opt);
            }
            // Default filter: check if option value includes search text
            const optionValue = opt.value?.toLowerCase() || '';
            // Show all options when search is empty (just typed @)
            if (searchText === '') return true;
            return optionValue.includes(searchText.toLowerCase());
          });

          setFilteredOptions(filtered);
          setIsDropdownOpen(filtered.length > 0);
          setSelectedIndex(0);
          return;
        }
      }
    }

    setIsDropdownOpen(false);
  };

  // Handle composition events for IME input
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    isComposingRef.current = false;
    handleInput(e as unknown as React.FormEvent<HTMLDivElement>);
  };

  // Handle key down events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Call parent onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }

    // Check if cursor is in mention and user tries to type
    if (isCursorInMention() && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      moveCursorAfterMentionWithSpace();

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let range;
        try {
          range = selection.getRangeAt(0);
          if (!range.startContainer || !range.endContainer) return;
          if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
            return;
          }
        } catch (err) {
          return;
        }

        const textNode = document.createTextNode(e.key);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        safelyAddRange(selection, range);

        // Trigger input update
        setTimeout(() => {
          if (editableRef.current) {
            const event = new Event('input', { bubbles: true });
            editableRef.current.dispatchEvent(event);
          }
        }, 0);
      }
      return;
    }

    // Handle arrow keys inside mentions
    if (isCursorInMention() && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      moveCursorAfterMentionWithSpace();
      return;
    }

    // Handle backspace/delete at mention boundaries
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let range;
        try {
          range = selection.getRangeAt(0);
          if (!range.startContainer || !range.endContainer) return;
          if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
            return;
          }
        } catch (err) {
          return;
        }

        if (e.key === 'Backspace' && range.collapsed) {
          const previousNode = range.startContainer.childNodes[range.startOffset - 1];
          if (
            previousNode &&
            previousNode.nodeType === Node.ELEMENT_NODE &&
            (previousNode as Element).getAttribute('data-mention') === 'true'
          ) {
            e.preventDefault();

            // Remove the mention
            previousNode.remove();

            // Also remove any space after it if it exists
            const nextNode = previousNode.nextSibling;
            if (
              nextNode &&
              nextNode.nodeType === Node.TEXT_NODE &&
              nextNode.textContent?.startsWith(' ')
            ) {
              if (nextNode.textContent.length === 1) {
                nextNode.remove();
              } else {
                nextNode.textContent = nextNode.textContent.substring(1);
              }
            }

            setTimeout(() => {
              if (editableRef.current) {
                const event = new Event('input', { bubbles: true });
                editableRef.current.dispatchEvent(event);
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
            (nextNode as Element).getAttribute('data-mention') === 'true'
          ) {
            e.preventDefault();
            nextNode.remove();

            setTimeout(() => {
              if (editableRef.current) {
                const event = new Event('input', { bubbles: true });
                editableRef.current.dispatchEvent(event);
              }
            }, 0);
            return;
          }
        }
      }
    }

    // Handle dropdown navigation
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
    }
  };

  // Handle option selection - MODIFIED TO FIX BUG
  const selectOption = (option: any) => {
    const plainText = value || '';
    const lastAtIndex = plainText.lastIndexOf('@', cursorPosition);

    if (lastAtIndex !== -1) {
      const beforeAt = plainText.slice(0, lastAtIndex);
      const afterCursor = plainText.slice(cursorPosition);

      // Ensure there's a space after the mention
      const newText = beforeAt + '@' + option.value + ' ' + afterCursor;

      onChange(newText);
      if (onSelect) onSelect(option);

      // Calculate new cursor position
      const newCursorPos = (beforeAt + '@' + option.value + ' ').length;
      setCursorPosition(newCursorPos);
    }

    setIsDropdownOpen(false);

    // Focus back on the input after a short delay
    setTimeout(() => {
      if (editableRef.current) {
        editableRef.current.focus();
        // Restore cursor position
        restoreCursorPosition(cursorPosition);
      }
    }, 10);
  };

  // Restore cursor position after HTML update
  const restoreCursorPosition = (offset: number) => {
    const selection = window.getSelection();
    if (!selection || !editableRef.current) return;
    if (!document.contains(editableRef.current)) return;

    try {
      selection.removeAllRanges();
    } catch (error) {
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
          } catch (error) {
            return false;
          }
        }
        currentPos += textLength;
        return false;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        if ((node as Element).getAttribute('data-mention') === 'true') {
          const textLength = node.textContent?.length || 0;
          if (currentPos + textLength >= offset) {
            // Cursor should be after the mention with a space
            // Insert a space after the mention if needed
            const nextSibling = node.nextSibling;
            if (
              nextSibling &&
              nextSibling.nodeType === Node.TEXT_NODE &&
              nextSibling.textContent?.startsWith(' ')
            ) {
              // Place cursor after the space
              try {
                newRange.setStart(nextSibling, 1);
                newRange.collapse(true);
                found = true;
                return true;
              } catch (error) {
                return false;
              }
            } else {
              // Create a space after the mention
              try {
                const spaceNode = document.createTextNode(' ');
                node.parentNode?.insertBefore(spaceNode, node.nextSibling);
                newRange.setStart(spaceNode, 1);
                newRange.collapse(true);
                found = true;
                return true;
              } catch (error) {
                return false;
              }
            }
          }
          currentPos += textLength;
          return false;
        }

        for (let i = 0; i < node.childNodes.length; i++) {
          if (walkNodes(node.childNodes[i])) {
            return true;
          }
        }
      }

      return false;
    };

    walkNodes(editableRef.current);

    if (found) {
      safelyAddRange(selection, newRange);
    } else {
      // Place cursor at end
      const lastNode = editableRef.current.lastChild;
      if (lastNode && document.contains(lastNode)) {
        try {
          if (lastNode.nodeType === Node.TEXT_NODE) {
            const textLength = lastNode.textContent?.length || 0;
            newRange.setStart(lastNode, textLength);
          } else {
            newRange.setStartAfter(lastNode);
          }
          newRange.collapse(true);
          safelyAddRange(selection, newRange);
        } catch (error) {
          return;
        }
      }
    }
  };

  // Update contenteditable with highlighted HTML
  useEffect(() => {
    if (editableRef.current && value !== undefined && !isUpdatingRef.current) {
      isUpdatingRef.current = true;

      const highlighted = createHighlightedHTML(value);

      // Only update if HTML has actually changed
      if (editableRef.current.innerHTML !== highlighted) {
        const selection = window.getSelection();
        const offset = selection && selection.rangeCount > 0 ? getCursorPosition() : value.length;

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        editableRef.current &&
        !editableRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle paste events to prevent HTML paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
    };

    const editable = editableRef.current;
    if (editable) {
      editable.addEventListener('paste', handlePaste);
      return () => {
        editable.removeEventListener('paste', handlePaste);
      };
    }
  }, []);

  // Handle click to move cursor outside mention if clicked inside
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) onClick(e);

    if (isCursorInMention()) {
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
          padding: '8px 12px',
          border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
          borderRadius: style?.borderRadius || 8,
          backgroundColor: themeWiseColor('#fff', '#1f1f1f', themeMode),
          color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)', themeMode),
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          cursor: 'text',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          fontSize: '14px',
          lineHeight: 1.5715,
        }}
      />

      {isDropdownOpen && filteredOptions.length > 0 && (
        <div
          ref={dropdownRef}
          className={`mentions-dropdown theme-${themeMode}`}
          style={{
            backgroundColor: themeWiseColor('#fff', '#1f1f1f', themeMode),
            border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
            color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)', themeMode),
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 4,
            zIndex: 9999,
            maxHeight: 200,
            overflowY: 'auto',
            borderRadius: 8,
            boxShadow:
              '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
          }}
        >
          {filteredOptions.map((option, index) => (
            <div
              key={option.key}
              className={`mentions-option ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => selectOption(option)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomMentionsInput;
