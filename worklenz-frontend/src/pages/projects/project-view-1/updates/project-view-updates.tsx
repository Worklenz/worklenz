import {
  Button,
  ConfigProvider,
  Flex,
  Form,
  Skeleton,
  Space,
  Tooltip,
  Typography,
  Dropdown,
  Menu,
  Popconfirm,
} from '@/shared/antd-imports';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { sanitizeCommentContent } from '@/utils/sanitizeInput';
import { useParams } from 'react-router-dom';

import CustomAvatar from '@components/CustomAvatar';
import { colors } from '@/styles/colors';
import {
  IMentionMemberSelectOption,
  IMentionMemberViewModel,
} from '@/types/project/projectComments.types';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { IProjectUpdateCommentViewModel } from '@/types/project/project.types';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { getUserSession } from '@/utils/session-helper';
import './project-view-updates.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { DeleteOutlined } from '@/shared/antd-imports';

const MAX_COMMENT_LENGTH = 2000;

// Helper function to escape HTML
const escapeHtml = (text: string) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

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

  // Process text to create HTML with highlighted mentions
  const createHighlightedHTML = (text: string) => {
    if (!text) return '';
    
    const highlightClass = themeMode === 'light' ? 'mention-highlight-light' : 'mention-highlight-dark';
    
    const mentions: Array<{start: number; end: number; text: string; option: any}> = [];
    
    for (const option of options) {
      const mentionText = `@${option.label}`;
      let startIndex = 0;
      
      while (startIndex < text.length) {
        const index = text.indexOf(mentionText, startIndex);
        if (index === -1) break;
        
        const beforeChar = index === 0 ? '' : text[index - 1];
        const afterChar = index + mentionText.length < text.length ? text[index + mentionText.length] : '';
        
        const isValidBefore = index === 0 || /\s/.test(beforeChar);
        const isValidAfter = afterChar === '' || /\s/.test(afterChar) || afterChar === ',';
        
        if (isValidBefore && isValidAfter) {
          const endIndex = index + mentionText.length;
          if (!mentions.some(m => index >= m.start && index < m.end)) {
            mentions.push({
              start: index,
              end: endIndex,
              text: mentionText,
              option
            });
          }
        }
        
        startIndex = index + 1;
      }
    }
    
    mentions.sort((a, b) => b.start - a.start);
    
    let result = escapeHtml(text);
    
    for (const mention of mentions) {
      const before = result.slice(0, mention.start);
      const after = result.slice(mention.end);
      const mentionHtml = `<span class="${highlightClass}" data-mention="true" data-mention-id="${mention.option.value}" contenteditable="false">${escapeHtml(mention.text)}</span>`;
      result = before + mentionHtml + after;
    }
    
    return result;
  };

  const extractPlainText = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
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
      if (!editableRef.current.contains(range.startContainer) || 
          !editableRef.current.contains(range.endContainer)) {
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

    let length = 0;
    const walker = document.createTreeWalker(
      editableRef.current!,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            return NodeFilter.FILTER_ACCEPT;
          }
          if (node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('data-mention') === 'true') {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === range.endContainer) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
          length += range.endOffset;
        } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
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
    
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode!;
    }
    
    while (node && node !== editableRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('data-mention') === 'true') {
        return true;
      }
      node = node.parentNode!;
    }
    
    return false;
  };

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
    
    const mention = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
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
    
    const textUpToCursor = plainText.slice(0, currentCursorPos);
    const lastAtIndex = textUpToCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const beforeAt = textUpToCursor.slice(0, lastAtIndex);
      const afterAt = textUpToCursor.slice(lastAtIndex);
      
      const charBeforeAt = beforeAt.slice(-1);
      if (!charBeforeAt || /\s/.test(charBeforeAt) || charBeforeAt === '\u00A0' || /[.,;:!?()]/.test(charBeforeAt)) {
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

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    isComposingRef.current = false;
    handleInput(e as unknown as React.FormEvent<HTMLDivElement>);
  };

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
          if (previousNode && previousNode.nodeType === Node.ELEMENT_NODE && 
              (previousNode as Element).getAttribute('data-mention') === 'true') {
            e.preventDefault();
            
            previousNode.remove();
            
            const nextNode = previousNode.nextSibling;
            if (nextNode && nextNode.nodeType === Node.TEXT_NODE && nextNode.textContent?.startsWith(' ')) {
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
          if (nextNode && nextNode.nodeType === Node.ELEMENT_NODE && 
              (nextNode as Element).getAttribute('data-mention') === 'true') {
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

  const selectOption = (option: any) => {
    const plainText = value || '';
    const lastAtIndex = plainText.lastIndexOf('@', cursorPosition);
    
    if (lastAtIndex !== -1) {
      const beforeAt = plainText.slice(0, lastAtIndex);
      const afterCursor = plainText.slice(cursorPosition);
      
      const newText = beforeAt + '@' + option.label + ' ' + afterCursor;
      
      onChange(newText);
      if (onSelect) onSelect(option);
      
      lastMentionedOptionsRef.current.add(option.value);
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
    
    if (!document.contains(editableRef.current)) {
      return;
    }

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
        if ((node as Element).getAttribute('data-mention') === 'true') {
          const textLength = node.textContent?.length || 0;
          if (currentPos + textLength >= offset) {
            const nextSibling = node.nextSibling;
            if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent?.startsWith(' ')) {
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
          if (walkNodes(node.childNodes[i])) {
            return true;
          }
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

  useEffect(() => {
    if (autoFocus && editableRef.current) {
      editableRef.current.focus();
    }
  }, [autoFocus]);

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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) onClick(e);
    
    if (isCursorInMention()) {
      moveCursorAfterMentionWithSpace();
    }
  };

  const themeWiseColor = (lightColor: string, darkColor: string) => {
    return themeMode === 'light' ? lightColor : darkColor;
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
          border: `1px solid ${themeWiseColor('#d9d9d9', '#434343')}`,
          borderRadius: style?.borderRadius || 4,
          backgroundColor: themeWiseColor('#fff', '#141414'),
          color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)'),
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
            backgroundColor: themeWiseColor('#fff', '#1f1f1f'),
            borderColor: themeWiseColor('#d9d9d9', '#434343'),
            color: themeWiseColor('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.85)'),
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
              key={option.value}
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

// Helper function to process mentions in displayed comments
const processMentions = (content: string) => {
  if (!content) return '';
  return content.replace(/@([\w]+(?:\s+[\w]+)*)/g, '<span class="mentions">@$1</span>');
};

// Helper function to process content for display
const processContent = (content: string) => {
  if (!content) return '';
  
  let sanitized = sanitizeCommentContent(content);
  sanitized = processMentions(sanitized);
  
  return sanitized;
};

const ProjectViewUpdates = () => {
  const { projectId } = useParams();
  const [characterLength, setCharacterLength] = useState<number>(0);
  const [isCommentBoxExpand, setIsCommentBoxExpand] = useState<boolean>(false);
  const [members, setMembers] = useState<IMentionMemberViewModel[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<{ id: string; name: string }[]>([]);
  const [comments, setComments] = useState<IProjectUpdateCommentViewModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [commentValue, setCommentValue] = useState<string>('');
  const theme = useAppSelector(state => state.themeReducer.mode);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const { t } = useTranslation('project-view-updates');
  const [form] = Form.useForm();

  const getMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const res = await projectCommentsApiService.getMentionMembers(
        projectId,
        1,
        15,
        null,
        null,
        null
      );
      if (res.done) {
        setMembers(res.body as IMentionMemberViewModel[]);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const getComments = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoadingComments(true);
      const res = await projectCommentsApiService.getByProjectId(projectId);
      if (res.done) {
        const processedComments = res.body.map((comment: IProjectUpdateCommentViewModel) => {
          const processedContent = processContent(comment.content || '');
          return {
            ...comment,
            content: processedContent,
          };
        });
        setComments(processedComments);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [projectId]);

  const handleAddComment = useCallback(async () => {
    if (!projectId || characterLength === 0) return;

    try {
      setIsSubmitting(true);

      if (!commentValue) {
        console.error('Comment content is empty');
        return;
      }

      const body = {
        project_id: projectId,
        team_id: getUserSession()?.team_id,
        content: commentValue.trim(),
        mentions: selectedMembers,
      };

      const res = await projectCommentsApiService.createProjectComment(body);
      if (res.done) {
        const processedContent = processContent(commentValue.trim());
        
        setComments(prev => [
          ...prev,
          {
            ...(res.body as IProjectUpdateCommentViewModel),
            created_by: getUserSession()?.name || '',
            created_at: new Date().toISOString(),
            content: processedContent,
            mentions: (res.body as IProjectUpdateCommentViewModel).mentions ?? [
              undefined,
              undefined,
            ],
          },
        ]);
        handleCancel();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [projectId, characterLength, commentValue, selectedMembers]);

  useEffect(() => {
    void getMembers();
    void getComments();
  }, [getMembers, getComments, refreshTimestamp]);

  const handleCancel = useCallback(() => {
    form.resetFields(['comment']);
    setCharacterLength(0);
    setIsCommentBoxExpand(false);
    setSelectedMembers([]);
    setCommentValue('');
  }, [form]);

  const mentionsOptions = useMemo(
    () =>
      members?.map(member => ({
        value: member.id,
        label: member.name,
      })) ?? [],
    [members]
  );

  const memberSelectHandler = useCallback((member: IMentionMemberSelectOption) => {
    if (!member?.value || !member?.label) return;

    setSelectedMembers(prev =>
      prev.some(mention => mention.id === member.value)
        ? prev
        : [...prev, { id: member.value, name: member.label }]
    );
  }, []);

  const handleCommentChange = useCallback((value: string) => {
    setCommentValue(value);
    setCharacterLength(value.trim().length);
  }, []);

  const handleDeleteComment = useCallback(
    async (commentId: string | undefined) => {
      if (!commentId) return;
      try {
        const res = await projectCommentsApiService.deleteComment(commentId);
        if (res.done) {
          void getComments();
        }
      } catch (error) {
        console.error('Failed to delete comment:', error);
      }
    },
    [getComments]
  );

  const handleCommentLinkClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      e.preventDefault();
      const href = (target as HTMLAnchorElement).getAttribute('href');
      if (href) {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }
  }, []);

  const configProviderTheme = useMemo(
    () => ({
      components: {
        Button: {
          defaultColor: colors.lightGray,
          defaultHoverColor: colors.darkGray,
        },
      },
    }),
    []
  );

  const getCommentMenu = useCallback(
    (commentId: string) => (
      <Menu>
        <Menu.Item key="delete">
          <Popconfirm
            title="Are you sure you want to delete this comment?"
            onConfirm={() => handleDeleteComment(commentId)}
            okText="Yes"
            cancelText="No"
          >
            Delete
          </Popconfirm>
        </Menu.Item>
      </Menu>
    ),
    [handleDeleteComment]
  );

  const renderComment = useCallback(
    (comment: IProjectUpdateCommentViewModel) => {
      const timeDifference = calculateTimeDifference(comment.created_at || '');
      const themeClass = theme === 'dark' ? 'dark' : 'light';

      return (
        <Dropdown
          key={comment.id ?? ''}
          overlay={getCommentMenu(comment.id ?? '')}
          trigger={['contextMenu']}
        >
          <div>
            <Flex gap={8}>
              <CustomAvatar avatarName={comment.created_by || ''} />
              <Flex vertical flex={1}>
                <Space>
                  <Typography.Text strong style={{ fontSize: 13, color: colors.lightGray }}>
                    {comment.created_by || ''}
                  </Typography.Text>
                  <Tooltip title={comment.created_at}>
                    <Typography.Text style={{ fontSize: 13, color: colors.deepLightGray }}>
                      {timeDifference}
                    </Typography.Text>
                  </Tooltip>
                </Space>
                <div className={`mentions-${themeClass}`}>
                  <Typography.Paragraph
                    style={{ margin: '8px 0' }}
                    ellipsis={{ rows: 3, expandable: true }}
                  >
                    <div
                      dangerouslySetInnerHTML={{ __html: comment.content || '' }}
                      onClick={handleCommentLinkClick}
                    />
                  </Typography.Paragraph>
                </div>
              </Flex>
            </Flex>
          </div>
        </Dropdown>
      );
    },
    [theme, handleDeleteComment, handleCommentLinkClick, getCommentMenu]
  );

  const commentsList = useMemo(() => comments.map(renderComment), [comments, renderComment]);

  return (
    <Flex gap={24} vertical>
      <Flex vertical gap={16}>
        {isLoadingComments ? <Skeleton active /> : commentsList}
      </Flex>

      <Form onFinish={handleAddComment}>
        <Form.Item>
          <CustomMentionsInput
            value={commentValue}
            placeholder={t('inputPlaceholder')}
            options={mentionsOptions}
            onSelect={(option: any) => memberSelectHandler(option as IMentionMemberSelectOption)}
            onClick={() => setIsCommentBoxExpand(true)}
            onChange={handleCommentChange}
            prefix="@"
            filterOption={(input: string, option: any) => {
              if (!input) return true;
              const optionLabel = option?.label || '';
              return optionLabel.toLowerCase().includes(input.toLowerCase());
            }}
            style={{
              minHeight: isCommentBoxExpand ? 180 : 60,
              paddingBlockEnd: 24,
            }}
            themeMode={theme}
          />
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              right: 12,
              color: colors.lightGray,
            }}
          >{`${characterLength}/${MAX_COMMENT_LENGTH}`}</span>
        </Form.Item>

        {isCommentBoxExpand && (
          <Form.Item>
            <Flex gap={8} justify="flex-end">
              <Button onClick={handleCancel} disabled={isSubmitting}>
                {t('cancelButton')}
              </Button>
              <Button
                type="primary"
                loading={isSubmitting}
                disabled={characterLength === 0}
                htmlType="submit"
              >
                {t('addButton')}
              </Button>
            </Flex>
          </Form.Item>
        )}
      </Form>
    </Flex>
  );
};

export default ProjectViewUpdates;