import React, { useState, useRef, useEffect, useCallback } from 'react';
import { themeWiseColor } from '@/utils/themeWiseColor';
import './project-view-updates.css';

interface MentionOption {
  key: string;
  value: string;
  label: React.ReactNode;
}

interface CustomMentionsInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (option: MentionOption) => void;
  themeMode: 'light' | 'dark';
  options: MentionOption[];
  placeholder?: string;
  autoFocus?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  filterOption?: (searchText: string, option: MentionOption) => boolean;
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

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
  filterOption,
  style,
  onKeyDown,
}: CustomMentionsInputProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<MentionOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const editableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const isUpdatingRef = useRef(false);
  const lineBreakJustInsertedRef = useRef(false);

  const editableStyle: React.CSSProperties = {
    ...style,
    minHeight: style?.minHeight ?? 60,
    maxHeight: style?.maxHeight ?? 200,
    overflowY: 'auto',
    padding: style?.padding ?? '8px 12px',
    border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
    borderRadius: style?.borderRadius ?? 8,
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
  };

  const dropdownStyle: React.CSSProperties = {
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
  };

  // Guard selection mutations because contentEditable updates can detach range nodes.
  const safelyAddRange = (selection: Selection, range: Range): boolean => {
    if (!selection || !range || !editableRef.current) return false;

    try {
      if (!range.startContainer || !range.endContainer) return false;
      if (!document.contains(editableRef.current)) return false;
      if (
        !document.contains(range.startContainer) ||
        !document.contains(range.endContainer)
      ) return false;
      if (
        !editableRef.current.contains(range.startContainer) ||
        !editableRef.current.contains(range.endContainer)
      ) return false;

      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  const getSafeRange = (): Range | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    try {
      const range = selection.getRangeAt(0);
      if (!range.startContainer || !range.endContainer) return null;
      if (
        !document.contains(range.startContainer) ||
        !document.contains(range.endContainer)
      ) return null;
      return range;
    } catch {
      return null;
    }
  };

  const dispatchInputEvent = () => {
    if (editableRef.current) {
      editableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const createHighlightedHTML = (text: string) => {
    if (!text) return '';

    if (text.includes('\n') && !text.includes('@')) {
      return text.split('\n').map(line => escapeHtml(line)).join('<br>');
    }

    const highlightClass =
      themeMode === 'light' ? 'mention-highlight-light' : 'mention-highlight-dark';

    const mentions: Array<{ start: number; end: number; text: string; option: MentionOption }> = [];

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
          const endIndex = index + mentionText.length;
          if (!mentions.some(m => index >= m.start && index < m.end)) {
            mentions.push({ start: index, end: endIndex, text: mentionText, option });
          }
        }

        startIndex = index + 1;
      }
    }

    mentions.sort((a, b) => b.start - a.start);

    let result = text;
    for (const mention of mentions) {
      const before = result.slice(0, mention.start);
      const after = result.slice(mention.end);
      const mentionHtml = `<span class="${highlightClass}" data-mention="true" data-mention-id="${mention.option.key}" contenteditable="false">${escapeHtml(mention.text)}</span>`;
      result = before + mentionHtml + after;
    }

    result = result.split('\n').map(part =>
      part.includes('<span') ? part : escapeHtml(part)
    ).join('<br>');

    return result;
  };

  const extractPlainText = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    let plainText = '';

    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent || '';
        if (text === '​') return;
        text = text.replace(/​/g, '');
        if (
          node.nextSibling &&
          (node.nextSibling as Element).tagName === 'BR' &&
          text.endsWith('\n') &&
          text.length > 1
        ) {
          text = text.replace(/\n$/, '');
        }
        plainText += text;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.getAttribute('data-mention') === 'true') {
          plainText += el.textContent || '';
        } else if (el.tagName === 'BR') {
          plainText += '\n';
        } else if (el.tagName === 'DIV' || el.tagName === 'P') {
          if (plainText.length > 0) plainText += '\n';
          for (let i = 0; i < el.childNodes.length; i++) {
            walkNodes(el.childNodes[i]);
          }
        } else {
          for (let i = 0; i < el.childNodes.length; i++) {
            walkNodes(el.childNodes[i]);
          }
        }
      }
    };

    walkNodes(temp);
    return plainText.replace(/\n$/, '');
  };

  const getCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editableRef.current) return 0;

    const range = getSafeRange();
    if (!range) return 0;

    let length = 0;
    const walker = document.createTreeWalker(
      editableRef.current!,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: node => {
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).getAttribute('data-mention') === 'true'
          ) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === range.endContainer) {
        length +=
          currentNode.nodeType === Node.TEXT_NODE
            ? range.endOffset
            : currentNode.textContent?.length ?? 0;
        break;
      }
      length += currentNode.textContent?.length ?? 0;
    }

    return length;
  };

  const isCursorInMention = () => {
    const range = getSafeRange();
    if (!range || !range.collapsed) return false;

    let node: Node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode!;

    while (node && node !== editableRef.current) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).getAttribute('data-mention') === 'true'
      ) return true;
      node = node.parentNode!;
    }

    return false;
  };

  const moveCursorAfterMentionWithSpace = () => {
    const selection = window.getSelection();
    if (!selection || !editableRef.current) return;

    const range = getSafeRange();
    if (!range) return;

    const mention =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;

    if (!mention || mention === editableRef.current) return;

    const newRange = document.createRange();
    const nextSibling = mention.nextSibling;

    if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      const textContent = nextSibling.textContent || '';
      if (textContent.startsWith(' ')) {
        newRange.setStart(nextSibling, textContent.length);
      } else {
        const space = document.createTextNode(' ');
        mention.parentNode?.insertBefore(space, nextSibling);
        newRange.setStart(space, space.textContent!.length);
      }
    } else {
      const space = document.createTextNode(' ');
      mention.parentNode?.insertBefore(space, mention.nextSibling);
      newRange.setStart(space, space.textContent!.length);
    }

    newRange.collapse(true);
    safelyAddRange(selection, newRange);
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isComposingRef.current || isUpdatingRef.current || lineBreakJustInsertedRef.current) return;

    const currentHTML = e.currentTarget.innerHTML;
    const plainText = extractPlainText(currentHTML);
    const currentCursorPos = getCursorPosition();
    setCursorPosition(currentCursorPos);

    if (plainText !== value) onChange(plainText);

    if (isCursorInMention()) {
      moveCursorAfterMentionWithSpace();
      return;
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
        charBeforeAt === ' ' ||
        /[.,;:!?()]/.test(charBeforeAt)
      ) {
        const textAfterAt = afterAt.slice(1);
        const spaceOrSpecialCharIndex = textAfterAt.search(/[\s,;:!?()]/);

        if (
          spaceOrSpecialCharIndex === -1 ||
          currentCursorPos <= lastAtIndex + 1 + spaceOrSpecialCharIndex
        ) {
          const searchText =
            spaceOrSpecialCharIndex === -1
              ? textAfterAt
              : textAfterAt.slice(0, spaceOrSpecialCharIndex);

          const filtered = options.filter(opt => {
            if (filterOption) return filterOption(searchText.toLowerCase(), opt);
            if (searchText === '') return true;
            return (opt.value?.toLowerCase() || '').includes(searchText.toLowerCase());
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

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    isComposingRef.current = false;
    handleInput(e as unknown as React.FormEvent<HTMLDivElement>);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDropdownOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      } else if (e.key === 'Enter' && filteredOptions.length > 0) {
        e.preventDefault();
        selectOption(filteredOptions[selectedIndex]);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsDropdownOpen(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        e.preventDefault();

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const br = document.createElement('br');
        range.insertNode(br);
        const zwsp = document.createTextNode('​');
        if (br.nextSibling) {
          br.parentNode?.insertBefore(zwsp, br.nextSibling);
        } else {
          br.parentNode?.appendChild(zwsp);
        }

        const newRange = document.createRange();
        newRange.setStart(zwsp, 1);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        lineBreakJustInsertedRef.current = true;

        requestAnimationFrame(() => {
          lineBreakJustInsertedRef.current = false;
          if (editableRef.current) {
            const updatedText = extractPlainText(editableRef.current.innerHTML);
            onChange(updatedText);
            dispatchInputEvent();
          }
        });

        return;
      } else {
        e.preventDefault();
        e.stopPropagation();
        lineBreakJustInsertedRef.current = false;
        if (onKeyDown) onKeyDown(e);
        return;
      }
    }

    if (isCursorInMention() && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      moveCursorAfterMentionWithSpace();

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = getSafeRange();
        if (!range) return;

        const textNode = document.createTextNode(e.key);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        safelyAddRange(selection, range);

        setTimeout(dispatchInputEvent, 0);
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
      if (!selection || selection.rangeCount === 0) return;

      const range = getSafeRange();
      if (!range) return;

      if (e.key === 'Backspace' && range.collapsed) {
        const previousNode = range.startContainer.childNodes[range.startOffset - 1];
        if (
          previousNode?.nodeType === Node.ELEMENT_NODE &&
          (previousNode as Element).getAttribute('data-mention') === 'true'
        ) {
          e.preventDefault();
          previousNode.remove();

          const nextNode = previousNode.nextSibling;
          if (nextNode?.nodeType === Node.TEXT_NODE && nextNode.textContent?.startsWith(' ')) {
            if (nextNode.textContent.length === 1) {
              nextNode.remove();
            } else {
              nextNode.textContent = nextNode.textContent.substring(1);
            }
          }

          setTimeout(dispatchInputEvent, 0);
          return;
        }
      }

      if (e.key === 'Delete' && range.collapsed) {
        const nextNode = range.startContainer.childNodes[range.startOffset];
        if (
          nextNode?.nodeType === Node.ELEMENT_NODE &&
          (nextNode as Element).getAttribute('data-mention') === 'true'
        ) {
          e.preventDefault();
          nextNode.remove();
          setTimeout(dispatchInputEvent, 0);
          return;
        }
      }
    }
  };

  const selectOption = (option: MentionOption) => {
    const plainText = editableRef.current
      ? extractPlainText(editableRef.current.innerHTML)
      : value || '';
    const lastAtIndex = plainText.lastIndexOf('@', cursorPosition);

    if (lastAtIndex !== -1) {
      const beforeAt = plainText.slice(0, lastAtIndex);
      const afterCursor = plainText.slice(cursorPosition);
      const newText = beforeAt + '@' + option.value + ' ' + afterCursor;

      onChange(newText);
      if (onSelect) onSelect(option);

      const newCursorPos = (beforeAt + '@' + option.value + ' ').length;
      setCursorPosition(newCursorPos);

      setIsDropdownOpen(false);

      setTimeout(() => {
        if (editableRef.current) {
          editableRef.current.focus();
          restoreCursorPosition(newCursorPos);
        }
      }, 10);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const restoreCursorPosition = (offset: number) => {
    const selection = window.getSelection();
    if (!selection || !editableRef.current) return;
    if (!document.contains(editableRef.current)) return;

    try {
      selection.removeAllRanges();
    } catch {
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
          } catch {
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
            const nextSibling = node.nextSibling;
            try {
              if (nextSibling?.nodeType === Node.TEXT_NODE && nextSibling.textContent?.startsWith(' ')) {
                newRange.setStart(nextSibling, 1);
              } else {
                const spaceNode = document.createTextNode(' ');
                node.parentNode?.insertBefore(spaceNode, node.nextSibling);
                newRange.setStart(spaceNode, 1);
              }
              newRange.collapse(true);
              found = true;
              return true;
            } catch {
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

    if (found) {
      safelyAddRange(selection, newRange);
    } else {
      const lastNode = editableRef.current.lastChild;
      if (lastNode && document.contains(lastNode)) {
        try {
          if (lastNode.nodeType === Node.TEXT_NODE) {
            newRange.setStart(lastNode, lastNode.textContent?.length ?? 0);
          } else {
            newRange.setStartAfter(lastNode);
          }
          newRange.collapse(true);
          safelyAddRange(selection, newRange);
        } catch {
          return;
        }
      }
    }
  };

  useEffect(() => {
    if (!editableRef.current || value === undefined || isUpdatingRef.current) return;

    const highlighted = createHighlightedHTML(value);
    const hasMentions = highlighted.includes('data-mention="true"');

    if (!hasMentions) {
      if (!value) {
        isUpdatingRef.current = true;
        editableRef.current.innerHTML = '';
        setTimeout(() => { isUpdatingRef.current = false; }, 0);
      }
      return;
    }

    const currentDOMText = extractPlainText(editableRef.current.innerHTML);
    if (currentDOMText.length > value.length) return;

    const isActive = document.activeElement === editableRef.current;
    if (isActive && currentDOMText === value) return;

    isUpdatingRef.current = true;

    const offset = isActive ? getCursorPosition() : null;
    editableRef.current.innerHTML = highlighted;

    if (isActive && offset !== null) {
      restoreCursorPosition(offset);
    }

    setTimeout(() => { isUpdatingRef.current = false; }, 0);
  }, [value, themeMode, options]);

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  useEffect(() => {
    if (autoFocus && editableRef.current) {
      editableRef.current.focus();
    }
  }, [autoFocus]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) onClick(e);
    if (isCursorInMention()) moveCursorAfterMentionWithSpace();
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
        style={editableStyle}
      />

      {isDropdownOpen && filteredOptions.length > 0 && (
        <div
          ref={dropdownRef}
          className={`mentions-dropdown theme-${themeMode}`}
          style={dropdownStyle}
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
