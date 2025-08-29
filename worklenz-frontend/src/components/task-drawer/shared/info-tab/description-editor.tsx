import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import DOMPurify from 'dompurify';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

// Lazy load TinyMCE editor to reduce initial bundle size
const LazyTinyMCEEditor = lazy(() =>
  import('@tinymce/tinymce-react').then(module => ({ default: module.Editor }))
);

interface DescriptionEditorProps {
  description: string | null;
  taskId: string;
  parentTaskId: string | null;
}

const DescriptionEditor = ({ description, taskId, parentTaskId }: DescriptionEditorProps) => {
  const { socket } = useSocket();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [content, setContent] = useState<string>(description || '');
  const [isEditorLoading, setIsEditorLoading] = useState<boolean>(false);
  const [wordCount, setWordCount] = useState<number>(0);
  const [isTinyMCELoaded, setIsTinyMCELoaded] = useState<boolean>(false);
  const editorRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // CSS styles for description content links
  const descriptionStyles = `
    .description-content a {
      color: ${themeMode === 'dark' ? '#4dabf7' : '#1890ff'} !important;
      text-decoration: underline !important;
      cursor: pointer !important;
    }
    .description-content a:hover {
      color: ${themeMode === 'dark' ? '#74c0fc' : '#40a9ff'} !important;
    }
  `;

  // Load TinyMCE script only when editor is opened
  const loadTinyMCE = async () => {
    if (isTinyMCELoaded) return;

    setIsEditorLoading(true);
    try {
      // Load TinyMCE script dynamically
      await new Promise<void>((resolve, reject) => {
        if ((window as any).tinymce) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = '/tinymce/tinymce.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load TinyMCE'));
        document.head.appendChild(script);
      });

      setIsTinyMCELoaded(true);
    } catch (error) {
      console.error('Failed to load TinyMCE:', error);
      setIsEditorLoading(false);
    }
  };

  const handleDescriptionChange = () => {
    if (!taskId) return;
    socket?.emit(
      SocketEvents.TASK_DESCRIPTION_CHANGE.toString(),
      JSON.stringify({
        task_id: taskId,
        description: content || null,
        parent_task: parentTaskId,
      })
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const wrapper = wrapperRef.current;
      const target = event.target as Node;

      const isClickedInsideWrapper = wrapper && wrapper.contains(target);
      const isClickedInsideEditor = document.querySelector('.tox-tinymce')?.contains(target);
      const isClickedInsideToolbarPopup = document
        .querySelector(
          '.tox-menu, .tox-pop, .tox-collection, .tox-dialog, .tox-dialog-wrap, .tox-silver-sink'
        )
        ?.contains(target);

      if (
        isEditorOpen &&
        !isClickedInsideWrapper &&
        !isClickedInsideEditor &&
        !isClickedInsideToolbarPopup
      ) {
        if (content !== description) {
          handleDescriptionChange();
        }
        setIsEditorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditorOpen, content, description, taskId, parentTaskId, socket]);

  const handleEditorChange = (content: string) => {
    const sanitizedContent = DOMPurify.sanitize(content);
    setContent(sanitizedContent);
    if (editorRef.current) {
      const count = editorRef.current.plugins.wordcount.getCount();
      setWordCount(count);
    }
  };

  const handleInit = (evt: any, editor: any) => {
    editorRef.current = editor;
    editor.on('focus', () => setIsEditorOpen(true));
    const initialCount = editor.plugins.wordcount.getCount();
    setWordCount(initialCount);
    setIsEditorLoading(false);
  };

  const handleOpenEditor = async () => {
    setIsEditorOpen(true);
    await loadTinyMCE();
  };

  const handleContentClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;

    // Check if clicked element is a link
    if (target.tagName === 'A' || target.closest('a')) {
      event.preventDefault(); // Prevent default link behavior
      event.stopPropagation(); // Prevent opening the editor
      const link = target.tagName === 'A' ? target : target.closest('a');
      if (link) {
        const href = (link as HTMLAnchorElement).href;
        if (href) {
          // Open link in new tab/window for security
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
      return;
    }

    // If not a link, open the editor
    handleOpenEditor();
  };

  const darkModeStyles =
    themeMode === 'dark'
      ? `
    body { 
      background-color: #1e1e1e !important;
      color: #ffffff !important;
    }
    body.mce-content-body[data-mce-placeholder]:not([contenteditable="false"]):before {
      color: #666666 !important;
    }
  `
      : '';

  return (
    <div ref={wrapperRef}>
      {/* Inject CSS styles for links */}
      <style>{descriptionStyles}</style>
      {isEditorOpen ? (
        <div
          style={{
            minHeight: '200px',
            backgroundColor: themeMode === 'dark' ? '#1e1e1e' : '#ffffff',
          }}
        >
          {isEditorLoading && (
            <div
              style={{
                position: 'absolute',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                height: '200px',
                backgroundColor:
                  themeMode === 'dark' ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                color: themeMode === 'dark' ? '#ffffff' : '#000000',
              }}
            >
              <div>Loading editor...</div>
            </div>
          )}
          {isTinyMCELoaded && (
            <Suspense fallback={<div>Loading editor...</div>}>
              <LazyTinyMCEEditor
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                value={content}
                onInit={handleInit}
                licenseKey="gpl"
                init={{
                  height: 200,
                  menubar: false,
                  branding: false,
                  plugins: [
                    'advlist',
                    'autolink',
                    'lists',
                    'link',
                    'charmap',
                    'preview',
                    'anchor',
                    'searchreplace',
                    'visualblocks',
                    'code',
                    'fullscreen',
                    'insertdatetime',
                    'media',
                    'table',
                    'code',
                    'wordcount',
                  ],
                  toolbar:
                    'blocks |' +
                    'bold italic underline strikethrough | ' +
                    'bullist numlist | link |  removeformat | help',
                  content_style: `
                    body { 
                      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
                      font-size: 14px;
                    }
                    ${darkModeStyles}
                  `,
                  skin: themeMode === 'dark' ? 'oxide-dark' : 'oxide',
                  content_css: themeMode === 'dark' ? 'dark' : 'default',
                  skin_url: `/tinymce/skins/ui/${themeMode === 'dark' ? 'oxide-dark' : 'oxide'}`,
                  content_css_cors: true,
                  auto_focus: true,
                  init_instance_callback: editor => {
                    editor.dom.setStyle(
                      editor.getBody(),
                      'backgroundColor',
                      themeMode === 'dark' ? '#1e1e1e' : '#ffffff'
                    );
                  },
                }}
                onEditorChange={handleEditorChange}
              />
            </Suspense>
          )}
        </div>
      ) : (
        <div
          onClick={handleContentClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            minHeight: '40px',
            padding: '8px 12px',
            border: `1px solid ${themeMode === 'dark' ? '#424242' : '#d9d9d9'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: isHovered
              ? themeMode === 'dark'
                ? '#2a2a2a'
                : '#fafafa'
              : themeMode === 'dark'
                ? '#1e1e1e'
                : '#ffffff',
            color: themeMode === 'dark' ? '#ffffff' : '#000000',
            transition: 'all 0.2s ease',
          }}
        >
          {content ? (
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(content),
              }}
              className="description-content"
            />
          ) : (
            <div
              style={{
                color: themeMode === 'dark' ? '#888888' : '#999999',
                fontStyle: 'italic',
              }}
            >
              Click to add description...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DescriptionEditor;
