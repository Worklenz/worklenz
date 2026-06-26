import { Button, Flex, Form, Typography, message, Tooltip, Space } from '@/shared/antd-imports';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PaperClipOutlined, DeleteOutlined, PlusOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { IMentionMemberSelectOption } from '@/types/project/projectComments.types';
import { ITaskCommentsCreateRequest } from '@/types/tasks/task-comments.types';
import { ITaskAttachment } from '@/types/tasks/task-attachment-view-model';
import logger from '@/utils/errorLogger';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMember } from '@/types/teamMembers/teamMember.types';
import { fromNow } from '@/utils/dateUtils';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import './info-tab-footer.css';

// Utility function to convert file to base64
const getBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Utility function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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
const COMMENT_ATTACHMENT_SIZE_LIMIT_BYTES = 25 * 1024 * 1024;

// Component to render mentions with highlighting using contenteditable
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
  ...props
}: any) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const editableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const lastMentionedOptionsRef = useRef<Set<string>>(new Set());
  const isUpdatingRef = useRef(false);

  /**
   * Builds the highlighted HTML shown inside the contentEditable div.
   *
   * Pass order:
   *   1. Collect all mention ranges (existing logic, unchanged).
   *   2. Collect all URL ranges (new).
   *   3. Merge & sort ranges by start position so they never overlap.
   *   4. Walk the plain text once and emit either a highlight span or
   *      escaped plain text for each segment.
   *
   * URLs that fall inside a mention are skipped automatically by the
   * overlap guard in step 3.
   */
  const createHighlightedHTML = (text: string) => {
    if (!text) return '';

    const mentionClass =
      themeMode === 'light' ? 'mention-highlight-light' : 'mention-highlight-dark';
    const urlClass = themeMode === 'light' ? 'url-highlight-light' : 'url-highlight-dark';

    // ── Step 1: collect mention ranges ──────────────────────────────────────
    type Range = { start: number; end: number; html: string };
    const ranges: Range[] = [];

    for (const option of options) {
      const mentionText = `@${option.value}`;
      let startIndex = 0;

      while (startIndex < text.length) {
        const index = text.indexOf(mentionText, startIndex);
        if (index === -1) break;

        const beforeChar = index === 0 ? '' : text[index - 1];
        const afterChar =
          index + mentionText.length < text.length ? text[index + mentionText.length] : '';

        const isValidBefore = index === 0 || /\s/.test(beforeChar);
        const isValidAfter = afterChar === '' || /\s/.test(afterChar) || afterChar === ',';

        if (isValidBefore && isValidAfter) {
          const end = index + mentionText.length;
          // Only add if not already covered by another range
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

    // ── Step 2: collect URL ranges ───────────────────────────────────────────
    // Reset lastIndex because the regex is defined outside the function
    URL_REGEX.lastIndex = 0;
    let urlMatch: RegExpExecArray | null;

    while ((urlMatch = URL_REGEX.exec(text)) !== null) {
      const start = urlMatch.index;
      const end = start + urlMatch[0].length;
      const rawUrl = urlMatch[0];

      // Skip if this URL is entirely inside an existing mention range
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

    // ── Step 3: sort ranges by start position (ascending) ───────────────────
    ranges.sort((a, b) => a.start - b.start);

    // ── Step 4: build the final HTML in a single pass ────────────────────────
    let result = '';
    let cursor = 0;

    for (const range of ranges) {
      if (range.start > cursor) {
        // Plain text segment before this range
        result += escapeHtml(text.slice(cursor, range.start));
      }
      result += range.html;
      cursor = range.end;
    }

    // Any remaining plain text after the last range
    if (cursor < text.length) {
      result += escapeHtml(text.slice(cursor));
    }

    return result;
  };

  // Extract plain text from HTML
  const extractPlainText = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    let plainText = '';

    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        plainText += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.getAttribute('data-mention') === 'true' || el.getAttribute('data-url') === 'true') {
          // For both mentions and URL spans, use their text content as-is
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

  // Helper function to safely add a range to selection
  const safelyAddRange = (selection: Selection, range: Range): boolean => {
    if (!selection || !range) return false;

    try {
      if (!range.startContainer || !range.endContainer) return false;

      if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
        return false;
      }

      if (!editableRef.current || !document.contains(editableRef.current)) {
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
    } catch (e) {
      console.debug('Failed to add range to selection:', e);
      return false;
    }
  };

  // Get cursor position that respects mention and URL span boundaries
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

      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editableRef.current!);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
    } catch (e) {
      return 0;
    }

    let length = 0;
    const walker = document.createTreeWalker(
      editableRef.current!,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: node => {
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            if (
              el.getAttribute('data-mention') === 'true' ||
              el.getAttribute('data-url') === 'true'
            ) {
              return NodeFilter.FILTER_ACCEPT;
            }
          }
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === selection.getRangeAt(0).endContainer) {
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

  // Check if cursor is inside a mention or URL span (both are non-editable)
  const isCursorInNonEditableSpan = () => {
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
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode!;

    while (node && node !== editableRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.getAttribute('data-mention') === 'true' || el.getAttribute('data-url') === 'true') {
          return true;
        }
      }
      node = node.parentNode!;
    }

    return false;
  };

  // Keep the old name as an alias so none of the existing call-sites break
  const isCursorInMention = isCursorInNonEditableSpan;

  // Move cursor after a non-editable span (mention or URL) with a space
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

    if (!mention || mention === editableRef.current || !document.contains(mention)) return;

    const newRange = document.createRange();
    let nextSibling = mention.nextSibling;

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
  };

  // Handle input changes
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isComposingRef.current || isUpdatingRef.current) return;

    const plainText = extractPlainText(e.currentTarget.innerHTML);
    const currentCursorPos = getCursorPosition();
    setCursorPosition(currentCursorPos);

    if (plainText !== value) {
      onChange(plainText);
    }

    if (isCursorInMention()) {
      moveCursorAfterMentionWithSpace();
    }

    // Check if user is typing a mention
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
          const filtered = options.filter((opt: any) =>
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

        setTimeout(() => {
          if (editableRef.current) {
            const event = new Event('input', { bubbles: true });
            editableRef.current.dispatchEvent(event);
          }
        }, 0);
      }
      return;
    }

    if (isCursorInMention() && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      moveCursorAfterMentionWithSpace();
      return;
    }

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
            ((previousNode as Element).getAttribute('data-mention') === 'true' ||
              (previousNode as Element).getAttribute('data-url') === 'true')
          ) {
            e.preventDefault();
            previousNode.remove();

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
            ((nextNode as Element).getAttribute('data-mention') === 'true' ||
              (nextNode as Element).getAttribute('data-url') === 'true')
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

  // Handle option selection
  const selectOption = (option: any) => {
    const plainText = value || '';
    const lastAtIndex = plainText.lastIndexOf('@', cursorPosition);

    if (lastAtIndex !== -1) {
      const beforeAt = plainText.slice(0, lastAtIndex);
      const afterCursor = plainText.slice(cursorPosition);

      const newText = beforeAt + '@' + option.value + ' ' + afterCursor;

      onChange(newText);
      if (onSelect) onSelect(option);

      lastMentionedOptionsRef.current.add(option.key);
    }

    setIsDropdownOpen(false);

    setTimeout(() => {
      if (editableRef.current) {
        editableRef.current.focus();
        moveCursorAfterMentionWithSpace();
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
            console.debug('Failed to set range start:', e);
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
            if (
              nextSibling &&
              nextSibling.nodeType === Node.TEXT_NODE &&
              nextSibling.textContent?.startsWith(' ')
            ) {
              try {
                newRange.setStart(nextSibling, 1);
                newRange.collapse(true);
                found = true;
                return true;
              } catch (e) {
                console.debug('Failed to set range start after space:', e);
                return false;
              }
            } else {
              try {
                const spaceNode = document.createTextNode(' ');
                node.parentNode?.insertBefore(spaceNode, node.nextSibling);
                newRange.setStart(spaceNode, 1);
                newRange.collapse(true);
                found = true;
                return true;
              } catch (e) {
                console.debug('Failed to create space node:', e);
                return false;
              }
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
          try {
            if (lastNode.nodeType === Node.TEXT_NODE) {
              const textLength = lastNode.textContent?.length || 0;
              newRange.setStart(lastNode, textLength);
            } else {
              newRange.setStartAfter(lastNode);
            }
            newRange.collapse(true);
            safelyAddRange(selection, newRange);
          } catch (e) {
            console.debug('Failed to set cursor at end:', e);
          }
        }
      }
    } catch (e) {
      console.debug('Selection restoration failed:', e);
    }
  };

  // Update contenteditable with highlighted HTML
  useEffect(() => {
    if (editableRef.current && value !== undefined && !isUpdatingRef.current) {
      isUpdatingRef.current = true;

      const highlighted = createHighlightedHTML(value);

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

  // Handle click — move cursor outside non-editable span if clicked inside one
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

      {isDropdownOpen && filteredOptions.length > 0 && (
        <div
          ref={dropdownRef}
          className={`mentions-dropdown theme-${themeMode}`}
          style={{
            backgroundColor: themeWiseColor('#fff', '#1f1f1f', themeMode),
            borderColor: themeWiseColor('#d9d9d9', '#434343', themeMode),
            color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)', themeMode),
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 1050,
            maxHeight: 200,
            overflowY: 'auto',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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

const InfoTabFooter = () => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const MAXIMUM_FILE_COUNT = 5;

  const [characterLength, setCharacterLength] = useState<number>(0);
  const [isCommentBoxExpand, setIsCommentBoxExpand] = useState<boolean>(false);
  const [attachmentComment, setAttachmentComment] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<ITaskAttachment[]>([]);

  const { taskFormViewModel, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const { hasBusinessAccess } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');

  const [members, setMembers] = useState<ITeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);

  const [selectedMembers, setSelectedMembers] = useState<
    { team_member_id: string; name: string }[]
  >([]);
  const [commentValue, setCommentValue] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const projectMembersList = useAppSelector(state => state.projectMemberReducer.membersList);

  const createdFromNow = useMemo(() => {
    const createdAt = taskFormViewModel?.task?.created_at;
    if (!createdAt) return 'N/A';
    try {
      return fromNow(createdAt);
    } catch (error) {
      console.error('Error formatting created_at:', error, createdAt);
      return 'N/A';
    }
  }, [taskFormViewModel?.task?.created_at]);

  const updatedFromNow = useMemo(() => {
    const updatedAt = taskFormViewModel?.task?.updated_at;
    if (!updatedAt) return 'N/A';
    try {
      return fromNow(updatedAt);
    } catch (error) {
      console.error('Error formatting updated_at:', error, updatedAt);
      return 'N/A';
    }
  }, [taskFormViewModel?.task?.updated_at]);

  const handleCancel = () => {
    form.resetFields(['comment']);
    setCharacterLength(0);
    setIsCommentBoxExpand(false);
    setSelectedFiles([]);
    setAttachmentComment(false);
    setCommentValue('');
    setSelectedMembers([]);
  };

  const isCommentValid = useCallback(() => {
    return characterLength > 0 || selectedFiles.length > 0;
  }, [characterLength, selectedFiles.length]);

  const getMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      setMembersLoading(true);
      const res = await teamMembersApiService.get(1, 10, null, null, null, true);

      if (res.done) {
        setMembers(res.body.data?.filter(t => !t.pending_invitation) as ITeamMember[]);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  const mentionsOptions =
    members?.map(member => ({
      value: member.name,
      label: member.name,
      key: member.id,
    })) ?? [];

  const memberSelectHandler = useCallback(
    (member: IMentionMemberSelectOption) => {
      if (!member?.value || !member?.label) return;

      const selectedMember = members.find(m => m.name === member.value);
      if (!selectedMember) return;

      setSelectedMembers(prev =>
        prev.some(mention => mention.team_member_id === selectedMember.id)
          ? prev
          : [
              ...prev,
              {
                team_member_id: selectedMember.id!,
                name: selectedMember.name!,
              },
            ]
      );
    },
    [members]
  );

  const handleCommentChange = useCallback((value: string) => {
    setCommentValue(value);
    setCharacterLength(value.trim().length);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedTaskId || !projectId) return;

    if (!isCommentValid()) {
      message.error(
        t('taskInfoTab.comments.addCommentError', {
          defaultValue: 'Please add a comment or attachment',
        })
      );
      return;
    }

    try {
      const hasOversizedAttachment = selectedFiles.some(
        file => Number(file.size || 0) > COMMENT_ATTACHMENT_SIZE_LIMIT_BYTES
      );

      if (!hasBusinessAccess && hasOversizedAttachment) {
        message.warning(
          t('taskInfoTab.comments.fileTooLargeToSend', {
            defaultValue:
              'Files over 25MB in comments require the Business plan. Remove this file or upgrade to continue.',
          })
        );
        if (isAppSumoUser) {
          trackAppSumoEvent(AppSumoUpsellEvents.COMMENT_ATTACHMENT_REPLACED, { feature: 'comment_attachments' });
          trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN, { feature: 'comment_attachments' });
        }
        promptUpgrade();
        return;
      }

      setUploading(true);
      const body: ITaskCommentsCreateRequest = {
        task_id: selectedTaskId,
        content: commentValue || '',
        mentions: Array.from(new Set(selectedMembers.map(member => JSON.stringify(member)))).map(
          str => JSON.parse(str)
        ),
        attachments: selectedFiles,
      };

      const res = await taskCommentsApiService.create(body);
      if (res.done) {
        form.resetFields(['comment']);
        setCharacterLength(0);
        setSelectedFiles([]);
        setAttachmentComment(false);
        setIsCommentBoxExpand(false);
        setCommentValue('');
        setSelectedMembers([]);

        document.dispatchEvent(
          new CustomEvent('task-comment-create', {
            detail: { taskId: selectedTaskId },
          })
        );
      }
    } catch (error) {
      logger.error('Failed to create comment:', error);
    } finally {
      setUploading(false);
    }
  }, [
    commentValue,
    selectedMembers,
    selectedFiles,
    selectedTaskId,
    projectId,
    form,
    isCommentValid,
    dispatch,
    t,
    hasBusinessAccess,
  ]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length || !selectedTaskId || !projectId) return;

    const files = Array.from(event.target.files);

    if (selectedFiles.length + files.length > MAXIMUM_FILE_COUNT) {
      message.error(
        t('taskInfoTab.comments.maxFilesError', {
          count: MAXIMUM_FILE_COUNT,
          defaultValue: 'You can only upload a maximum of {{count}} files',
        })
      );
      return;
    }

    try {
      setUploading(true);
      setAttachmentComment(true);

      const newFiles: ITaskAttachment[] = [];

      for (const file of files) {
        const base64Data = await getBase64(file);
        const attachment: ITaskAttachment = {
          file: base64Data,
          file_name: file.name,
          project_id: projectId,
          task_id: selectedTaskId,
          size: file.size,
        };
        newFiles.push(attachment);
      }

      setSelectedFiles(prev => [...prev, ...newFiles]);

      if (!isCommentBoxExpand) {
        setIsCommentBoxExpand(true);
      }
    } catch (error) {
      console.error('Failed to process files:', error);
      message.error(
        t('taskInfoTab.comments.processFilesError', {
          defaultValue: 'Failed to process files',
        })
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      if (newFiles.length === 0) setAttachmentComment(false);
      return newFiles;
    });
  };

  useEffect(() => {
    void getMembers();
  }, [getMembers]);

  return (
    <Flex
      vertical
      style={{
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 80,
      }}
    >
      <div
        style={{
          marginBlockEnd: 0,
          height: 1,
          position: 'absolute',
          top: 0,
          width: '100%',
          backgroundColor: themeWiseColor('#ebebeb', '#3a3a3a', themeMode),
        }}
      />

      {!isCommentBoxExpand ? (
        <Flex
          vertical
          style={{
            width: '100%',
            padding: '12px 0',
            transition: 'all 0.3s ease-in-out',
          }}
        >
          <CustomMentionsInput
            placeholder={t('taskInfoTab.comments.addCommentPlaceholder', {
              defaultValue: 'Add a comment...',
            })}
            options={mentionsOptions}
            value={commentValue}
            onClick={() => setIsCommentBoxExpand(true)}
            onChange={(e: string) => {
              setCommentValue(e);
              setCharacterLength(e.length);
            }}
            prefix="@"
            filterOption={(input: string, option: any) => {
              if (!input) return true;
              const optionLabel = option?.label || '';
              return optionLabel.toLowerCase().includes(input.toLowerCase());
            }}
            style={{
              minHeight: 60,
              resize: 'none',
              borderRadius: 4,
              transition: 'all 0.3s ease-in-out',
            }}
            themeMode={themeMode}
          />
        </Flex>
      ) : (
        <Form
          form={form}
          style={{
            width: '100%',
            transition: 'all 0.3s ease-in-out',
            animation: 'expandAnimation 0.3s ease-in-out',
          }}
        >
          {selectedFiles.length > 0 && (
            <Flex vertical gap={8} style={{ marginTop: 12 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {t('taskInfoTab.comments.selectedFiles', {
                  count: MAXIMUM_FILE_COUNT,
                  defaultValue: 'Selected Files (Maximum of {{count}})',
                })}
              </Typography.Title>
              <Flex
                vertical
                style={{
                  border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
                  borderRadius: 4,
                  padding: '8px 16px',
                  backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
                }}
              >
                {selectedFiles.map((file, index) => (
                  <Flex
                    key={index}
                    justify="space-between"
                    align="center"
                    style={{
                      padding: '8px 0',
                      borderBottom:
                        index < selectedFiles.length - 1
                          ? `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`
                          : 'none',
                    }}
                  >
                    <Typography.Text
                      style={{
                        color: themeWiseColor('#000000d9', '#ffffffd9', themeMode),
                      }}
                    >
                      {file.file_name} ({formatFileSize(file.size)})
                    </Typography.Text>
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removeFile(index)}
                      style={{ color: '#f5222d' }}
                    />
                  </Flex>
                ))}
                <Flex
                  justify="center"
                  align="center"
                  style={{
                    marginTop: 8,
                    cursor: selectedFiles.length >= MAXIMUM_FILE_COUNT ? 'not-allowed' : 'pointer',
                    opacity: selectedFiles.length >= MAXIMUM_FILE_COUNT ? 0.5 : 1,
                  }}
                  onClick={() => {
                    if (selectedFiles.length < MAXIMUM_FILE_COUNT && !uploading) {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    disabled={selectedFiles.length >= MAXIMUM_FILE_COUNT || uploading}
                  >
                    {t('taskInfoTab.comments.addMoreFiles', {
                      defaultValue: 'Add More Files',
                    })}
                  </Button>
                </Flex>
              </Flex>
            </Flex>
          )}

          <Form.Item name={'comment'} style={{ marginBlock: 12 }}>
            <div style={{ position: 'relative' }}>
              <CustomMentionsInput
                placeholder={t('taskInfoTab.comments.addCommentPlaceholder', {
                  defaultValue: 'Add a comment...',
                })}
                options={mentionsOptions}
                autoFocus
                value={commentValue}
                onSelect={(option: any) =>
                  memberSelectHandler(option as IMentionMemberSelectOption)
                }
                onChange={handleCommentChange}
                prefix="@"
                filterOption={(input: string, option: any) => {
                  if (!input) return true;
                  const optionLabel = option?.label || '';
                  return optionLabel.toLowerCase().includes(input.toLowerCase());
                }}
                style={{
                  minHeight: 100,
                  maxHeight: 200,
                  paddingBlockEnd: 24,
                  borderRadius: 4,
                }}
                themeMode={themeMode}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 12,
                  color: colors.lightGray,
                  fontSize: 12,
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              >{`${characterLength}/5000`}</span>
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Flex gap={8} justify="space-between">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={uploading || selectedFiles.length >= MAXIMUM_FILE_COUNT}
                multiple
              />
              <Tooltip
                title={
                  selectedFiles.length >= MAXIMUM_FILE_COUNT
                    ? t('taskInfoTab.comments.maxFilesError', {
                        count: MAXIMUM_FILE_COUNT,
                        defaultValue: 'You can only upload a maximum of {{count}} files',
                      })
                    : t('taskInfoTab.comments.attachFiles', {
                        defaultValue: 'Attach Files',
                      })
                }
              >
                <Button
                  icon={<PaperClipOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || selectedFiles.length >= MAXIMUM_FILE_COUNT}
                />
              </Tooltip>

              <Space>
                <Button onClick={handleCancel}>
                  {t('taskInfoTab.comments.cancel', {
                    defaultValue: 'Cancel',
                  })}
                </Button>
                <Button
                  type="primary"
                  disabled={!isCommentValid()}
                  onClick={handleSubmit}
                  loading={uploading}
                >
                  {t('taskInfoTab.comments.commentButton', {
                    defaultValue: 'Comment',
                  })}
                </Button>
              </Space>
            </Flex>
          </Form.Item>
        </Form>
      )}

      <Flex align="center" justify="space-between" style={{ width: '100%', marginTop: 8 }}>
        <Tooltip title={createdFromNow !== 'N/A' ? `Created ${createdFromNow}` : 'N/A'}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('taskInfoTab.comments.createdBy', {
              defaultValue: 'Created {time} by {user}',
              time: createdFromNow,
              user: taskFormViewModel?.task?.reporter || '',
            })}
          </Typography.Text>
        </Tooltip>
        <Tooltip title={updatedFromNow !== 'N/A' ? `Updated ${updatedFromNow}` : 'N/A'}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('taskInfoTab.comments.updatedTimes', {
              defaultValue: 'Updated {{time}}',
              time: updatedFromNow,
            })}
          </Typography.Text>
        </Tooltip>
      </Flex>
    </Flex>
  );
};

export default InfoTabFooter;
