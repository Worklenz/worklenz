import type { ClientPortalChatConversation } from '@/api/client-portal/client-portal-api';
import type { TempChatsType } from './chat-container/chat-box/chat-box-wrapper';

export type ChatStatusTag = 'active' | 'expired' | 'invited';
export type ChatDotTone = 'unread' | 'active' | 'none';

/** Only these portal statuses get a tag in the list; "not invited" clients show none. */
export const getChatStatusTag = (
  conversation: ClientPortalChatConversation
): ChatStatusTag | null => {
  const status = conversation.portalStatus?.status;
  return status === 'active' || status === 'expired' || status === 'invited' ? status : null;
};

/** Red when there is something unread, blue when the portal is active, otherwise no dot. */
export const getChatDotTone = (conversation: ClientPortalChatConversation): ChatDotTone => {
  if (conversation.unreadCount > 0) return 'unread';
  return conversation.portalStatus?.status === 'active' ? 'active' : 'none';
};

/** Search matches on the client name only, so a message can't reach the wrong client by accident. */
export const filterChatConversations = (
  conversations: ClientPortalChatConversation[],
  query: string
): ClientPortalChatConversation[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return conversations;
  return conversations.filter(conversation => conversation.name.toLowerCase().includes(needle));
};

/** The shape ChatBox expects for the conversation that is open. */
export const toOpenedChat = (conversation: ClientPortalChatConversation): TempChatsType => ({
  id: conversation.id,
  clientId: conversation.clientId,
  name: conversation.name || '?',
  chats_data: [],
  status: conversation.unreadCount > 0 ? 'unread' : 'read',
  lastMessage: conversation.lastMessage ?? '',
  lastMessageTime: conversation.lastMessageAt ?? '',
  unreadCount: conversation.unreadCount,
});
