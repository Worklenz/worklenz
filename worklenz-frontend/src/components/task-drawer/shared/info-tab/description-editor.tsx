import React, { ComponentType, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import 'react-quill/dist/quill.snow.css';
import './description-editor.css';

const LazyQuillEditor = lazy(() =>
  import('react-quill').then(module => ({
    default: module.default as unknown as ComponentType<any>,
  }))
);
interface DescriptionEditorProps {
  description: string | null;
  taskId: string;
  parentTaskId: string | null;
}

const COLLAPSE_MAX_HEIGHT = 120;

const DescriptionEditor = ({ description, taskId, parentTaskId }: DescriptionEditorProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const { socket } = useSocket();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  const [isHovered, setIsHovered] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [content, setContent] = useState(description || '');
  const [wordCount, setWordCount] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLongContent, setIsLongContent] = useState(false);
  useEffect(() => {
    setContent(description || '');
    setIsExpanded(false);
    setIsLongContent(false);
  }, [description, taskId]);

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  );

  useEffect(() => {
    if (!content || isEditorOpen) return;
    const raf = requestAnimationFrame(() => {
      if (contentRef.current) {
        setIsLongContent(contentRef.current.scrollHeight > COLLAPSE_MAX_HEIGHT);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [content, isEditorOpen]);

  const formats = useMemo(
    () => ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'link'],
    []
  );

  const extractWordCount = useCallback((html: string) => {
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? text.split(' ').length : 0;
  }, []);

  const processHTML = useCallback((html: string) => {
   if (!html) return html;
   const parser = new DOMParser();
   const doc = parser.parseFromString(html, 'text/html');
   const children = Array.from(doc.body.children);
  
   let olCounter = 0; // track consecutive ol group
   let lastWasOlGroup = false;


   children.forEach((el, index) => {
     const tag = el.tagName.toLowerCase();
    
     if (tag === 'ol') {
       olCounter++;
       (el as HTMLElement).setAttribute('start', String(olCounter));
       lastWasOlGroup = true;
     } else if (tag === 'ul') {
       const prev = children[index - 1];
       if (prev && prev.tagName.toLowerCase() === 'ol') {
         el.classList.add('ql-nested-list');
       }
       // don't reset counter — ul between ol items shouldn't break numbering
     } else {
       // any non-list element resets the counter
       olCounter = 0;
       lastWasOlGroup = false;
     }
   });
  
   return doc.body.innerHTML;
 }, []);


  const processMentions = useCallback((html: string) => {
    if (!html || html.includes('class="mentions"')) return html;
    const mentionRegex = /(^|[^\w.+-])@([\w-]+)/g;
    return html.replace(mentionRegex, '$1<span class="mentions">@$2</span>');
  }, []);

  const emitDescriptionChange = useCallback(() => {
    if (!taskId) return;
    const sanitizedContent = DOMPurify.sanitize(content || '',{ ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'] });
    socket?.emit(
      SocketEvents.TASK_DESCRIPTION_CHANGE.toString(),
      JSON.stringify({
        task_id: taskId,
        description: sanitizedContent || null,
        parent_task: parentTaskId,
      })
    );
  }, [content, parentTaskId, socket, taskId]);

  const closeEditorAndPersist = useCallback(() => {
    if (content !== (description || '')) {
      emitDescriptionChange();
    }
    setIsEditorOpen(false);
  }, [content, description, emitDescriptionChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isEditorOpen || !wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        closeEditorAndPersist();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditorOpen, closeEditorAndPersist]);

  const handleEditorChange = (nextHtml: string) => {
    const sanitizedContent = DOMPurify.sanitize(nextHtml,{ ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'] });
    setContent(sanitizedContent);
    setWordCount(extractWordCount(sanitizedContent));
  };

  const handleOpenEditor = () => {
    setIsEditorOpen(true);
    setWordCount(extractWordCount(content || ''));
  };

  const handleToggleExpand = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsExpanded(prev => !prev);
  };

  const shellClass = `description-editor-shell ${isDarkMode ? 'is-dark' : 'is-light'}`;

  return (
    <div ref={wrapperRef} className={shellClass}>
      {isEditorOpen ? (
        <div className="description-editor-active">
          <Suspense
            fallback={
              <div className="description-editor-loading">
                {t('description.loadingEditor', { defaultValue: 'Loading editor...' })}
              </div>
            }
          >
            <LazyQuillEditor
              theme="snow"
              value={content}
              onChange={handleEditorChange}
              modules={modules}
              formats={formats}
            />
          </Suspense>
          <div className="description-editor-footer">
            <span>
              {t('description.wordCount', { defaultValue: '{{count}} words', count: wordCount })}
            </span>
          </div>
        </div>
      ) : <div
        className={`description-editor-preview ${isHovered ? 'is-hovered' : ''}`}
        onClick={event => {
          const target = event.target as HTMLElement;
          if (target.tagName === 'A' || target.closest('a')) {
            event.preventDefault();
            event.stopPropagation();
            const link = target.tagName === 'A' ? target : target.closest('a');
            if (link) {
              const href = (link as HTMLAnchorElement).href;
              if (href) window.open(href, '_blank', 'noopener,noreferrer');
            }
            return;
          }
          handleOpenEditor();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {(!content || content === '<p><br></p>') && (
          <div className="description-placeholder">
            {t('taskInfoTab.description.clickToAdd')}
          </div>
        )}

        {/* Render actual content if exists */}
        {content && (
          <>
            <div
              ref={contentRef}
              className="description-content"
              dangerouslySetInnerHTML={{ __html:  (() => {
 const result = processHTML(processMentions(content));

 return result;
})()
 }}
              style={
                isLongContent && !isExpanded
                  ? {
                    overflow: 'hidden',
                    maxHeight: `${COLLAPSE_MAX_HEIGHT}px`,
                    WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
                    maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
                    pointerEvents: 'none',
                  }
                  : undefined
              }
            />
            {isLongContent && (
              <button
                onClick={handleToggleExpand}
                style={{
                  marginTop: '4px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isDarkMode ? '#888888' : '#999999',
                  display: 'block',
                }}
              >
                {isExpanded ? t('taskInfoTab.description.showLess')
                  : t('taskInfoTab.description.readMore')}
              </button>
            )}
          </>
        )}
      </div>}
    </div>
  );
};

export default DescriptionEditor;
