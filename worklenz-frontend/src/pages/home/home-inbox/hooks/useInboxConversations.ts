import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGetOrganizationChatsQuery } from '@/ee/api/client-portal/client-portal-api';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import {
  IInboxProjectConversation,
  INewProjectCommentSocketPayload,
  IProjectCommentDeletedSocketPayload,
} from '@/types/home/inbox.types';
import { TempChatsType } from '@/ee/pages/client-portal/chats/chat-container/chat-box/chat-box-wrapper';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';

export type InboxCategory = 'project' | 'client';

export type InboxConversation = TempChatsType & {
  category: InboxCategory;
  colorCode?: string;
  lastCommentId?: string;
  authorName?: string;
};

const pinnedStorageKey = (userId?: string) => `worklenz.inbox.pinnedChats.${userId || 'anonymous'}`;

const loadPinnedIds = (userId?: string): string[] => {
  try {
    const raw = localStorage.getItem(pinnedStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const stripHtml = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
};

const toProjectConversation = (row: IInboxProjectConversation): InboxConversation => ({
  id: row.id,
  category: 'project',
  name: row.name || 'Untitled project',
  chats_data: [],
  status: (row.unread_count > 0 ? 'unread' : 'read') as 'read' | 'unread',
  lastMessage: row.last_preview || '',
  lastMessageTime: row.last_at || '',
  unreadCount: row.unread_count || 0,
  participants: [],
  colorCode: row.color_code,
  lastCommentId: row.last_comment_id,
  authorName: row.author_name,
});

export const useInboxConversations = () => {
  const currentSession = useAuthService().getCurrentSession();
  const userId = currentSession?.id;
  const { socket } = useSocket();

  const [projectRows, setProjectRows] = useState<InboxConversation[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => loadPinnedIds(userId));

  const projectRowsRef = useRef(projectRows);
  projectRowsRef.current = projectRows;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  // Projects opened via "New chat" before they have any messages; the server
  // list only returns projects WITH messages, so keep these rows locally
  // until their first message lands.
  const draftIdsRef = useRef<Set<string>>(new Set());

  const {
    data: apiChatsData,
    isLoading: isLoadingChats,
    refetch: refetchClients,
  } = useGetOrganizationChatsQuery({}, { refetchOnMountOrArgChange: true });

  const fetchProjectConversations = useCallback(async () => {
    try {
      const res = await projectCommentsApiService.getInboxConversations();
      if (res.done) {
        const serverRows = (res.body || []).map(toProjectConversation);
        const serverIds = new Set(serverRows.map(r => r.id));
        draftIdsRef.current.forEach(id => {
          if (serverIds.has(id)) draftIdsRef.current.delete(id);
        });
        const drafts = projectRowsRef.current.filter(
          c => draftIdsRef.current.has(c.id) && !serverIds.has(c.id)
        );
        setProjectRows([...drafts, ...serverRows]);
      }
    } catch {
      // list keeps its previous state; a later socket event retriggers the fetch
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjectConversations();
  }, [fetchProjectConversations]);

  const markRead = useCallback((projectId: string) => {
    setProjectRows(prev =>
      prev.map(c =>
        c.id === projectId ? { ...c, unreadCount: 0, status: 'read' as const } : c
      )
    );
    projectCommentsApiService.markConversationRead(projectId).catch(() => {});
  }, []);

  const togglePin = useCallback(
    (conversationId: string) => {
      setPinnedIds(prev => {
        const next = prev.includes(conversationId)
          ? prev.filter(id => id !== conversationId)
          : [...prev, conversationId];
        try {
          localStorage.setItem(pinnedStorageKey(userId), JSON.stringify(next));
        } catch {
          // storage full/unavailable — pin still applies for this session
        }
        return next;
      });
    },
    [userId]
  );

  // Realtime: update list rows in place; refetch only when we can't patch.
  useEffect(() => {
    if (!socket) return;

    const onNewComment = (payload: INewProjectCommentSocketPayload | boolean) => {
      if (!payload || typeof payload !== 'object' || !payload.project_id) {
        void fetchProjectConversations();
        return;
      }
      const exists = projectRowsRef.current.some(c => c.id === payload.project_id);
      if (!exists) {
        // First message of a project we haven't listed yet
        void fetchProjectConversations();
        return;
      }
      const isOwn = payload.author_id === userId;
      const isOpen =
        selectedIdRef.current === payload.project_id && document.visibilityState === 'visible';
      setProjectRows(prev =>
        prev.map(c => {
          if (c.id !== payload.project_id) return c;
          const unreadCount = isOwn || isOpen ? c.unreadCount || 0 : (c.unreadCount || 0) + 1;
          return {
            ...c,
            lastMessage: payload.preview || c.lastMessage,
            lastMessageTime: payload.created_at || new Date().toISOString(),
            lastCommentId: payload.comment_id,
            authorName: payload.author_name || c.authorName,
            unreadCount,
            status: (unreadCount > 0 ? 'unread' : 'read') as 'read' | 'unread',
          };
        })
      );
      if (isOpen && !isOwn) {
        projectCommentsApiService.markConversationRead(payload.project_id).catch(() => {});
      }
    };

    const onCommentDeleted = (payload: IProjectCommentDeletedSocketPayload) => {
      if (!payload?.project_id) return;
      const conv = projectRowsRef.current.find(c => c.id === payload.project_id);
      // Only the preview depends on the deleted message
      if (conv && conv.lastCommentId === payload.comment_id) {
        void fetchProjectConversations();
      }
    };

    socket.on(SocketEvents.NEW_PROJECT_COMMENT_RECEIVED.toString(), onNewComment);
    socket.on(SocketEvents.PROJECT_COMMENT_DELETED.toString(), onCommentDeleted);
    return () => {
      socket.off(SocketEvents.NEW_PROJECT_COMMENT_RECEIVED.toString(), onNewComment);
      socket.off(SocketEvents.PROJECT_COMMENT_DELETED.toString(), onCommentDeleted);
    };
  }, [socket, userId, fetchProjectConversations]);

  // Keep the open conversation's preview in sync with the thread (covers the
  // sender's own messages — the server skips the author on socket emits).
  const updatesList = useAppSelector(state => (state as any).updatesReducer?.updatesList);
  useEffect(() => {
    const openId = selectedIdRef.current;
    if (!openId || !Array.isArray(updatesList) || updatesList.length === 0) return;
    const last = [...updatesList].reverse().find((c: any) => !c.is_deleted);
    if (!last) return;
    setProjectRows(prev =>
      prev.map(c =>
        c.id === openId
          ? {
              ...c,
              lastMessage: stripHtml(last.content || '') || c.lastMessage,
              lastMessageTime: last.created_at || c.lastMessageTime,
              lastCommentId: last.id || c.lastCommentId,
              authorName: last.created_by || c.authorName,
            }
          : c
      )
    );
  }, [updatesList]);

  const clientConversations = useMemo<InboxConversation[]>(() => {
    let chatsArray: any[] = [];
    if (Array.isArray(apiChatsData)) {
      chatsArray = apiChatsData;
    } else if (apiChatsData && typeof apiChatsData === 'object') {
      const data = apiChatsData as any;
      if (Array.isArray(data.chats)) chatsArray = data.chats;
      else if (Array.isArray(data.body)) chatsArray = data.body;
      else if (Array.isArray(data.data)) chatsArray = data.data;
    }

    return chatsArray.map((chat: any) => {
      let clientId = chat.clientId;
      if (!clientId && chat.id?.includes('-')) {
        const parts = chat.id.split('-');
        if (parts.length >= 4) {
          const dateStrTest = parts.slice(-3).join('-');
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrTest)) clientId = parts.slice(0, -3).join('-');
        }
      }
      return {
        id: chat.id || '',
        category: 'client' as const,
        name: chat.clientName || chat.title || chat.participants?.join(', ') || 'Unknown',
        chats_data: [],
        status: (chat.unreadCount > 0 ? 'unread' : 'read') as 'read' | 'unread',
        lastMessage: chat.lastMessage || '',
        lastMessageTime: chat.lastMessageTime || chat.lastMessageAt || '',
        unreadCount: chat.unreadCount || 0,
        participants: chat.participants || [],
        clientId: clientId || chat.clientId,
      };
    });
  }, [apiChatsData]);

  const sortAndFilter = useCallback(
    (list: InboxConversation[]) => {
      const q = search.trim().toLowerCase();
      const filtered = q
        ? list.filter(
            c =>
              (c.name || '').toLowerCase().includes(q) ||
              (c.lastMessage || '').toLowerCase().includes(q)
          )
        : list;
      return [...filtered].sort((a, b) => {
        const aPinned = pinnedIds.includes(a.id) ? 1 : 0;
        const bPinned = pinnedIds.includes(b.id) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bTime - aTime;
      });
    },
    [search, pinnedIds]
  );

  const projectConversations = useMemo(
    () => sortAndFilter(projectRows),
    [projectRows, sortAndFilter]
  );
  const filteredClientConversations = useMemo(
    () => sortAndFilter(clientConversations),
    [clientConversations, sortAndFilter]
  );
  const allConversations = useMemo(
    () => sortAndFilter([...projectRows, ...clientConversations]),
    [projectRows, clientConversations, sortAndFilter]
  );

  const projectBadge = useMemo(
    () => projectRows.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [projectRows]
  );
  const clientBadge = useMemo(
    () => clientConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [clientConversations]
  );

  const selectConversation = useCallback(
    (conversation: InboxConversation) => {
      setSelectedId(conversation.id);
      if (conversation.category === 'project' && (conversation.unreadCount || 0) > 0) {
        markRead(conversation.id);
      }
    },
    [markRead]
  );

  // "New chat": open a project conversation, creating a local draft row when
  // the project has no messages yet (one conversation per project — an
  // existing one is simply selected).
  const openProjectConversation = useCallback(
    (project: { id: string; name?: string; colorCode?: string }) => {
      const existing = projectRowsRef.current.find(c => c.id === project.id);
      if (existing) {
        selectConversation(existing);
        return;
      }
      draftIdsRef.current.add(project.id);
      const draft: InboxConversation = {
        id: project.id,
        category: 'project',
        name: project.name || 'Untitled project',
        chats_data: [],
        status: 'read',
        lastMessage: '',
        lastMessageTime: '',
        unreadCount: 0,
        participants: [],
        colorCode: project.colorCode,
      };
      setProjectRows(prev => [draft, ...prev]);
      setSelectedId(project.id);
    },
    [selectConversation]
  );

  return {
    projectConversations,
    clientConversations: filteredClientConversations,
    // Unfiltered by the sidebar search box - for "already has a conversation"
    // lookups (e.g. in New Chat) that must not depend on what's typed there.
    allClientConversations: clientConversations,
    allConversations,
    projectBadge,
    clientBadge,
    loading: loadingProjects || isLoadingChats,
    search,
    setSearch,
    pinnedIds,
    togglePin,
    selectedId,
    setSelectedId,
    selectConversation,
    openProjectConversation,
    markRead,
    refetchProjects: fetchProjectConversations,
    refetchClients,
  };
};
