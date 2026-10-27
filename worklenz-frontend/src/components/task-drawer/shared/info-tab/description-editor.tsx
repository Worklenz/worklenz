import React, { ComponentType, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { Button, message } from '@/shared/antd-imports';
import logger from '@/utils/errorLogger';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { createMentionEnterBinding } from './description-editor-keyboard';
import 'react-quill-new/dist/quill.snow.css';
import './description-editor.css';

interface DescriptionChangeAck {
  success: boolean;
  error?: string;
}

const SAVE_ACK_TIMEOUT_MS = 10000;

interface MentionMember {
  id: string;
  name: string;
}

interface QuillBounds {
  left: number;
  top: number;
  bottom: number;
}

interface QuillEditorInstance {
  root: HTMLDivElement;
  getText: () => string;
  getSelection: (focus?: boolean) => { index: number; length: number } | null;
  getBounds: (index: number, length?: number) => QuillBounds | null;
  getFormat: (index: number, length?: number) => Record<string, unknown>;
  formatText: (
    index: number,
    length: number,
    format: string,
    value: unknown,
    source?: 'api' | 'user' | 'silent'
  ) => void;
  deleteText: (index: number, length: number, source?: 'api' | 'user' | 'silent') => void;
  insertText: (
    index: number,
    text: string,
    formats?: Record<string, unknown>,
    source?: 'api' | 'user' | 'silent'
  ) => void;
  setSelection: (
    index: number,
    length?: number,
    source?: 'api' | 'user' | 'silent'
  ) => void;
  focus: () => void;
}

interface QuillEditorHandle {
  getEditor: () => QuillEditorInstance;
}

interface MentionQuery {
  query: string;
  start: number;
  end: number;
  top: number;
  left: number;
}

const registerMentionFormat = (Quill: typeof import('react-quill-new').Quill) => {
  const InlineBlot = Quill.import('blots/inline') as typeof import('quill/blots/inline').default;

  class MentionBlot extends InlineBlot {
    static blotName = 'mention';
    static tagName = 'span';
    static className = 'mentions';
  }

  Quill.register(MentionBlot, true);
};

const LazyQuillEditor = lazy(() =>
  import('react-quill-new').then(module => {
    registerMentionFormat(module.Quill);
    return { default: module.default as unknown as ComponentType<any> };
  })
);
interface DescriptionEditorProps {
  description: string | null;
  taskId: string;
  parentTaskId: string | null;
  projectId?: string | null;
  isGuest?: boolean;
}

const COLLAPSE_MAX_HEIGHT = 120;

// Quill 2 emits both bullet and ordered lists as <ol>, distinguishing them with
// li[data-list="bullet|ordered"]. Dropping data-list would render every bullet
// list as a numbered one, so it has to survive sanitisation.
//
// `style` is deliberately absent: the configured toolbar (header, bold/italic/
// underline/strike, list, link, clean) has no control that emits inline
// styles — alignment uses ql-align-* classes, already covered by `class` — so
// allowing it would only open a `style="position:fixed;..."` full-viewport
// overlay for no benefit. Matches the backend's sanitizeRichTextDescription.
const SANITIZE_CONFIG = {
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-list'],
};

const findMentionRanges = (text: string, members: MentionMember[]) => {
  const normalizedText = text.toLocaleLowerCase();
  const ranges: Array<{ start: number; length: number }> = [];
  const orderedMembers = [...members].sort((a, b) => b.name.length - a.name.length);

  orderedMembers.forEach(member => {
    const mention = `@${member.name.trim()}`;
    if (mention.length < 2) return;
    const normalizedMention = mention.toLocaleLowerCase();
    let searchFrom = 0;
    let matchIndex = normalizedText.indexOf(normalizedMention, searchFrom);

    while (matchIndex !== -1) {
      const previousCharacter = matchIndex > 0 ? text[matchIndex - 1] : '';
      const nextCharacter = text[matchIndex + mention.length] || '';
      const hasValidStart = !previousCharacter || /[\s([{,:;.!?]/.test(previousCharacter);
      const hasValidEnd = !nextCharacter || /[\s.,;:!?)}\]]/.test(nextCharacter);
      const overlapsExisting = ranges.some(
        range =>
          matchIndex < range.start + range.length &&
          matchIndex + mention.length > range.start
      );

      if (hasValidStart && hasValidEnd && !overlapsExisting) {
        ranges.push({ start: matchIndex, length: mention.length });
      }

      searchFrom = matchIndex + mention.length;
      matchIndex = normalizedText.indexOf(normalizedMention, searchFrom);
    }
  });

  return ranges;
};

const applyMentionFormatting = (editor: QuillEditorInstance, members: MentionMember[]) => {
  const text = editor.getText();
  findMentionRanges(text, members).forEach(({ start, length }) => {
    if (editor.getFormat(start, length).mention !== true) {
      editor.formatText(start, length, 'mention', true, 'silent');
    }
  });
};

const DescriptionEditor = ({
  description,
  taskId,
  parentTaskId,
  projectId,
  isGuest = false,
}: DescriptionEditorProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const { socket, connected } = useSocket();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  const [isHovered, setIsHovered] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [content, setContent] = useState(description || '');
  const [wordCount, setWordCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<QuillEditorHandle | null>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLongContent, setIsLongContent] = useState(false);
  const [mentionMembers, setMentionMembers] = useState<MentionMember[]>([]);
  const [isLoadingMentionMembers, setIsLoadingMentionMembers] = useState(false);
  const [mentionMembersLoadFailed, setMentionMembersLoadFailed] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const mentionMembersCacheRef = useRef<{ projectId: string; members: MentionMember[] } | null>(null);
  const mentionQueryRef = useRef(mentionQuery);
  const filteredMentionMembersRef = useRef<MentionMember[]>([]);
  const selectedMentionIndexRef = useRef(selectedMentionIndex);
  const insertMentionRef = useRef<(member: MentionMember) => void>(() => undefined);
  mentionQueryRef.current = mentionQuery;
  selectedMentionIndexRef.current = selectedMentionIndex;

  useEffect(() => {
    if (!isEditorOpen || !projectId) {
      setMentionQuery(null);
      return;
    }

    const cachedMembers = mentionMembersCacheRef.current;
    if (cachedMembers?.projectId === projectId) {
      setMentionMembers(cachedMembers.members);
      setMentionMembersLoadFailed(false);
      return;
    }

    let isCancelled = false;
    setMentionMembers([]);
    setMentionMembersLoadFailed(false);
    setIsLoadingMentionMembers(true);

    projectCommentsApiService
      .getMentionMembers(projectId, 1, 200, null, null, '')
      .then(response => {
        if (isCancelled) return;
        if (!response.done) {
          throw new Error(response.message || 'Member request was unsuccessful');
        }
        const members: MentionMember[] = [];
        (response.body || []).forEach(member => {
          if (member.id && member.name) {
            members.push({
              id: member.id,
              name: member.name,
            });
          }
        });
        mentionMembersCacheRef.current = { projectId, members };
        setMentionMembers(members);
      })
      .catch(error => {
        if (isCancelled) return;
        logger.error('Failed to load task description mention members', { projectId, error });
        setMentionMembersLoadFailed(true);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingMentionMembers(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isEditorOpen, projectId]);

  useEffect(() => {
    if (!isEditorOpen || mentionMembers.length === 0) return;
    const frame = requestAnimationFrame(() => {
      const editor = quillRef.current?.getEditor();
      if (editor) applyMentionFormatting(editor, mentionMembers);
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditorOpen, mentionMembers]);

  // Mirrors of state used inside effect cleanups / callbacks that must see
  // the latest value without re-subscribing (avoids stale closures).
  const isEditorOpenRef = useRef(isEditorOpen);
  useEffect(() => {
    isEditorOpenRef.current = isEditorOpen;
  }, [isEditorOpen]);

  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Last known-persisted value for the task currently loaded into the editor.
  // Only this — never the live `description` prop — decides whether there
  // are unsaved edits, since the prop can change for reasons unrelated to
  // this editor's draft (e.g. a collaborator's own edit arriving over the
  // socket while this user is still typing).
  const baselineRef = useRef(description || '');

  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Best-effort save used when we can no longer keep the editor open to wait
  // for an ack: the task/parentTaskId being switched away from, or unmount.
  // Fire-and-forget by necessity, but still reports failures instead of
  // silently dropping the edit like the previous implementation did.
  const flushPendingSave = useCallback(
    (flushTaskId: string, flushParentTaskId: string | null, html: string) => {
      const activeSocket = socketRef.current;
      if (!flushTaskId || !activeSocket) return;
      const sanitizedContent = DOMPurify.sanitize(html || '', SANITIZE_CONFIG);
      activeSocket.emit(
        SocketEvents.TASK_DESCRIPTION_CHANGE.toString(),
        JSON.stringify({
          task_id: flushTaskId,
          description: sanitizedContent || null,
          parent_task: flushParentTaskId,
        }),
        (response?: DescriptionChangeAck) => {
          if (!response?.success) {
            logger.error('Failed to save task description on task switch/unmount', {
              taskId: flushTaskId,
              error: response?.error,
            });
          }
        }
      );
    },
    []
  );

  // Flush unsaved edits before switching away from this task (task changed
  // while the editor was open) or on unmount. Runs as the cleanup of an
  // effect scoped to [taskId, parentTaskId] so the closure captures the
  // *previous* task's identifiers — exactly the ones the pending edit
  // belongs to.
  useEffect(() => {
    return () => {
      if (isEditorOpenRef.current && contentRef.current !== baselineRef.current) {
        flushPendingSave(taskId, parentTaskId, contentRef.current);
      }
    };
  }, [taskId, parentTaskId, flushPendingSave]);

  const prevTaskIdRef = useRef(taskId);
  useEffect(() => {
    const taskChanged = prevTaskIdRef.current !== taskId;
    prevTaskIdRef.current = taskId;

    // While the editor is open on the *same* task, don't let an incoming
    // `description` prop update (e.g. a real-time update echoed back from
    // this same save, or another collaborator's change) clobber in-progress
    // local edits. Switching tasks always resets, since the old task's
    // unsaved edits were just flushed above.
    if (isEditorOpenRef.current && !taskChanged) return;

    setContent(description || '');
    baselineRef.current = description || '';
    setIsExpanded(false);
    setIsLongContent(false);
    setSaveError(null);
    if (taskChanged) setIsEditorOpen(false);
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
      keyboard: {
        bindings: {
          mentionEnter: createMentionEnterBinding(
            () => Boolean(mentionQueryRef.current),
            () => filteredMentionMembersRef.current[selectedMentionIndexRef.current],
            member => insertMentionRef.current(member)
          ),
        },
      },
    }),
    []
  );

  useEffect(() => {
    if (!content || isEditorOpen) return;
    const raf = requestAnimationFrame(() => {
      if (previewContentRef.current) {
        setIsLongContent(previewContentRef.current.scrollHeight > COLLAPSE_MAX_HEIGHT);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [content, isEditorOpen]);

  // 'bullet' is not a registered format in Quill 2 — 'list' covers both the
  // ordered and bulleted variants. Leaving it in makes Quill log an error for
  // an unknown format on init.
  const formats = useMemo(
    () => ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'link', 'mention'],
    []
  );

 const extractWordCount = useCallback((html: string) => {
  if (!html) return 0;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const text = doc.body.textContent?.trim() || '';

  return text ? text.split(/\s+/).length : 0;
}, []);

  // Classifies a list element as ordered or bulleted. Quill 1 used <ul>/<ol>;
  // Quill 2 emits <ol> for both and marks the items with data-list, so the tag
  // alone is no longer enough. Descriptions saved before the Quill 2 upgrade
  // still use the old markup, so both shapes have to be understood here.
  const isOrderedList = useCallback((el: Element) => {
    if (el.tagName.toLowerCase() === 'ul') return false;
    const firstItem = el.querySelector('li');
    const listType = firstItem?.getAttribute('data-list');
    // Legacy <ol> from Quill 1 carries no data-list and is always ordered.
    return listType ? listType === 'ordered' : true;
  }, []);

  const processHTML = useCallback(
    (html: string) => {
      if (!html) return html;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const children = Array.from(doc.body.children);

      let olCounter = 0; // track consecutive ol group

      children.forEach((el, index) => {
        const tag = el.tagName.toLowerCase();

        if (tag !== 'ol' && tag !== 'ul') {
          // any non-list element resets the counter
          olCounter = 0;
          return;
        }

        if (isOrderedList(el)) {
          olCounter++;
          (el as HTMLElement).setAttribute('start', String(olCounter));
        } else {
          // Bulleted list: never numbered, and never breaks an ordered run.
          const prev = children[index - 1];
          if (prev && prev.tagName.toLowerCase() === 'ol' && isOrderedList(prev)) {
            el.classList.add('ql-nested-list');
          }
        }
      });

      return doc.body.innerHTML;
    },
    [isOrderedList]
  );


  const processMentions = useCallback((html: string) => {
    if (!html || html.includes('class="mentions"')) return html;
    const mentionRegex = /(^|[^\w.+-])@([\w-]+)/g;
    return html.replace(mentionRegex, '$1<span class="mentions">@$2</span>');
  }, []);

  // Wrap bare http(s) URLs that appear as plain text in anchors so they render
  // as clickable links. Walks text nodes only, so existing <a> tags and mention
  // spans are left untouched. Display-only — does not change what is stored.
  const autoLinkUrls = useCallback((html: string) => {
    if (!html || !/https?:\/\//i.test(html)) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const targets: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) {
      if (current.parentElement?.closest('a')) continue; // already a link
      if (/https?:\/\//i.test(current.nodeValue || '')) targets.push(current as Text);
    }
    targets.forEach(textNode => {
      const text = textNode.nodeValue || '';
      const frag = doc.createDocumentFragment();
      const re = /https?:\/\/[^\s<>"]+/gi;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text))) {
        const url = match[0].replace(/[.,;:!?)]+$/, '');
        if (match.index > lastIndex) {
          frag.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
        }
        const a = doc.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.textContent = url;
        frag.appendChild(a);
        lastIndex = match.index + url.length;
      }
      if (lastIndex < text.length) {
        frag.appendChild(doc.createTextNode(text.slice(lastIndex)));
      }
      textNode.parentNode?.replaceChild(frag, textNode);
    });
    return doc.body.innerHTML;
  }, []);

  const isDirty = content !== baselineRef.current;

  // Sends whatever is currently in the draft. Always reads contentRef at
  // call time rather than closing over a value, so a save queued behind
  // another one picks up the latest edits instead of re-sending stale text.
  const runSingleSave = useCallback((): Promise<boolean> => {
    const sanitizedContent = DOMPurify.sanitize(contentRef.current || '', SANITIZE_CONFIG);
    if (sanitizedContent === baselineRef.current) return Promise.resolve(true);

    if (!taskId || !socket || !connected) {
      const msg = t('description.offline', {
        defaultValue: "You're offline — the description wasn't saved. Reconnect and try again.",
      });
      setSaveError(msg);
      message.error(msg);
      return Promise.resolve(false);
    }

    setSaveError(null);

    return new Promise<boolean>(resolve => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const msg = t('description.saveTimeout', {
          defaultValue: 'Saving the description timed out. Please try again.',
        });
        setSaveError(msg);
        message.error(msg);
        resolve(false);
      }, SAVE_ACK_TIMEOUT_MS);

      socket.emit(
        SocketEvents.TASK_DESCRIPTION_CHANGE.toString(),
        JSON.stringify({
          task_id: taskId,
          description: sanitizedContent || null,
          parent_task: parentTaskId,
        }),
        (response?: DescriptionChangeAck) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (!response || response.success) {
            baselineRef.current = sanitizedContent;
            resolve(true);
          } else {
            const msg =
              response.error ||
              t('description.saveFailed', {
                defaultValue: 'Failed to save the description. Please try again.',
              });
            setSaveError(msg);
            message.error(msg);
            resolve(false);
          }
        }
      );
    });
  }, [taskId, parentTaskId, socket, connected, t]);

  // Serializes saves so two overlapping triggers (e.g. Save click followed
  // by click-outside before the first ack lands) never emit concurrently —
  // the second is queued behind the first and re-reads the draft when its
  // turn comes, so it always sends the latest content rather than racing it.
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const pendingSaveCountRef = useRef(0);

  const persist = useCallback((): Promise<boolean> => {
    if (pendingSaveCountRef.current === 0) setIsSaving(true);
    pendingSaveCountRef.current += 1;

    const run = saveQueueRef.current.then(() => runSingleSave());
    saveQueueRef.current = run;

    run.finally(() => {
      pendingSaveCountRef.current -= 1;
      if (pendingSaveCountRef.current === 0) setIsSaving(false);
    });

    return run;
  }, [runSingleSave]);

  // Only close once the draft that resolved is still the latest one — if
  // more edits landed while this particular save was queued/in flight, a
  // later queued save is already carrying them and will close when *it*
  // catches up, so closing here would strand those newer edits mid-editor.
  const closeIfCaughtUp = useCallback((ok: boolean) => {
    if (ok && contentRef.current === baselineRef.current) setIsEditorOpen(false);
  }, []);

  const handleSaveClick = useCallback(() => {
    void persist().then(closeIfCaughtUp);
  }, [persist, closeIfCaughtUp]);

  const handleDiscardClick = useCallback(() => {
    setContent(baselineRef.current);
    setSaveError(null);
    setIsEditorOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isEditorOpen || !wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target as Node)) return;
      if (contentRef.current === baselineRef.current) {
        setIsEditorOpen(false);
        return;
      }
      // Keep the editor open until the save is confirmed — closing early on
      // a failed/dropped save is exactly what used to lose edits silently.
      void persist().then(closeIfCaughtUp);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditorOpen, persist, closeIfCaughtUp]);

  // Escape discards the in-progress edit, mirroring the explicit Discard
  // button rather than silently saving.
  useEffect(() => {
    if (!isEditorOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mentionQueryRef.current) return;
        event.stopPropagation();
        handleDiscardClick();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isEditorOpen, handleDiscardClick]);

  const filteredMentionMembers = useMemo(() => {
    if (!mentionQuery) return [];
    const query = mentionQuery.query.trim().toLocaleLowerCase();
    return mentionMembers
      .filter(member => member.name.toLocaleLowerCase().includes(query))
      .slice(0, 8);
  }, [mentionMembers, mentionQuery]);
  filteredMentionMembersRef.current = filteredMentionMembers;
  const shouldShowMentionSuggestions =
    mentionQuery &&
    (isLoadingMentionMembers ||
      mentionMembersLoadFailed ||
      filteredMentionMembers.length > 0 ||
      !/\s/.test(mentionQuery.query));

  const updateMentionQuery = useCallback((editor: QuillEditorInstance | null) => {
    if (!editor) {
      setMentionQuery(null);
      return;
    }

    const selection = editor.getSelection();
    if (!selection || selection.length > 0) {
      setMentionQuery(null);
      return;
    }

    const beforeCursor = editor.getText().slice(0, selection.index);
    const match = /(^|[\s([{,:;.!?])@([^\n@]*)$/u.exec(beforeCursor);
    if (!match) {
      setMentionQuery(null);
      return;
    }

    const start = match.index + match[1].length;
    const bounds = editor.getBounds(selection.index);
    const editorRect = editor.root.getBoundingClientRect();
    const left = Math.max(8, editorRect.left + (bounds?.left || 0));
    const caretTop = editorRect.top + (bounds?.bottom || 0);
    const top =
      typeof window !== 'undefined' && caretTop + 220 > window.innerHeight
        ? Math.max(8, editorRect.top + (bounds?.top || 0) - 210)
        : caretTop;

    setSelectedMentionIndex(0);
    setMentionQuery({
      query: match[2],
      start,
      end: selection.index,
      top,
      left:
        typeof window !== 'undefined'
          ? Math.min(left, Math.max(8, window.innerWidth - 288))
          : left,
    });
  }, []);

  const insertMention = useCallback(
    (member: MentionMember) => {
      if (!mentionQuery || !quillRef.current) return;
      const editor = quillRef.current.getEditor();
      const mention = `@${member.name}`;
      const mentionEnd = mentionQuery.start + mention.length;

      editor.focus();
      editor.deleteText(mentionQuery.start, mentionQuery.end - mentionQuery.start, 'user');
      editor.insertText(mentionQuery.start, mention, { mention: true }, 'user');
      editor.insertText(mentionEnd, ' ', {}, 'user');
      editor.setSelection(mentionEnd + 1, 0, 'silent');
      setMentionQuery(null);
    },
    [mentionQuery]
  );
  insertMentionRef.current = insertMention;

  const handleEditorKeyDown: React.KeyboardEventHandler<HTMLDivElement> = event => {
    if (!mentionQuery) return;

    if (event.key === 'ArrowDown' && filteredMentionMembers.length > 0) {
      event.preventDefault();
      setSelectedMentionIndex(index => (index + 1) % filteredMentionMembers.length);
    } else if (event.key === 'ArrowUp' && filteredMentionMembers.length > 0) {
      event.preventDefault();
      setSelectedMentionIndex(
        index => (index - 1 + filteredMentionMembers.length) % filteredMentionMembers.length
      );
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setMentionQuery(null);
    }
  };

  const handleEditorChange = (nextHtml: string) => {
    const editor = quillRef.current?.getEditor();
    if (editor) applyMentionFormatting(editor, mentionMembers);
    const currentHtml = editor?.root.innerHTML || nextHtml;
    const sanitizedContent = DOMPurify.sanitize(currentHtml, SANITIZE_CONFIG);
    setContent(sanitizedContent);
    setWordCount(extractWordCount(sanitizedContent));
    updateMentionQuery(editor || null);
  };

  const handleEditorSelectionChange = () => {
    const editor = quillRef.current?.getEditor();
    if (editor) applyMentionFormatting(editor, mentionMembers);
    updateMentionQuery(editor || null);
  };

  const handleOpenEditor = () => {
    if (isGuest) return; // Prevent guests from editing description
    setIsEditorOpen(true);
    setSaveError(null);
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
              ref={quillRef}
              theme="snow"
              value={content}
              onChange={handleEditorChange}
              onChangeSelection={handleEditorSelectionChange}
              onKeyDown={handleEditorKeyDown}
              modules={modules}
              formats={formats}
            />
          </Suspense>
          {shouldShowMentionSuggestions && mentionQuery && (
            <div
              className={`description-mention-suggestions ${isDarkMode ? 'is-dark' : 'is-light'}`}
              role="listbox"
              aria-label={t('description.mentionSuggestions', {
                defaultValue: 'Team member suggestions',
              })}
              data-testid="description-mention-suggestions"
              style={{ top: mentionQuery.top, left: mentionQuery.left }}
            >
              {isLoadingMentionMembers ? (
                <div className="description-mention-suggestion-message" role="status">
                  {t('description.loadingMembers', {
                    defaultValue: 'Loading team members...',
                  })}
                </div>
              ) : mentionMembersLoadFailed ? (
                <div className="description-mention-suggestion-message" role="status">
                  {t('description.membersLoadFailed', {
                    defaultValue: 'Team members could not be loaded.',
                  })}
                </div>
              ) : filteredMentionMembers.length > 0 ? (
                filteredMentionMembers.map((member, index) => (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected={index === selectedMentionIndex}
                    className={
                      index === selectedMentionIndex
                        ? 'description-mention-suggestion is-selected'
                        : 'description-mention-suggestion'
                    }
                    onMouseDown={event => {
                      event.preventDefault();
                      insertMention(member);
                    }}
                    onClick={() => insertMention(member)}
                  >
                    {member.name}
                  </button>
                ))
              ) : (
                <div className="description-mention-suggestion-message">
                  {t('description.noMembersFound', {
                    defaultValue: 'No team members found.',
                  })}
                </div>
              )}
            </div>
          )}
          <div className="description-editor-footer">
            <span>
              {t('description.wordCount', { defaultValue: '{{count}} words', count: wordCount })}
            </span>
            {saveError && (
              <span className="description-editor-save-error">{saveError}</span>
            )}
            <div className="description-editor-actions">
              <Button size="small" onClick={handleDiscardClick} disabled={isSaving}>
                {t('description.discard', { defaultValue: 'Discard' })}
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={handleSaveClick}
                loading={isSaving}
                disabled={!isDirty}
              >
                {t('description.save', { defaultValue: 'Save' })}
              </Button>
            </div>
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
        onMouseEnter={() => !isGuest && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={isGuest ? { cursor: 'default' } : undefined}
      >
        {(!content || content === '<p><br></p>') && (
          <div className="description-placeholder">
            {t('taskInfoTab.description.clickToAdd', {
              defaultValue: 'Click to add description',
            })}
          </div>
        )}

        {/* Render actual content if exists */}
        {content && (
          <>
            <div
              ref={previewContentRef}
              className="description-content"
              // `content` is only ever sanitized on the write path (see
              // handleEditorChange/persist below) — it is set
              // directly from the server-provided `description` prop with no
              // sanitization in between (line 45). That description can arrive
              // from outside this editor entirely — the CSV/Jira/Monday
              // importer writes task descriptions straight to the database via
              // a service call that never passes through the sanitizing body
              // validators. Sanitize right here, at the last point before it
              // reaches the DOM, so it's correct regardless of how `content`
              // got its value.
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  processHTML(autoLinkUrls(processMentions(content))),
                  SANITIZE_CONFIG
                ),
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
