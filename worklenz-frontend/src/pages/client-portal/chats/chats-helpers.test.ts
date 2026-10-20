import { describe, expect, it } from 'vitest';
import type { ClientPortalChatConversation } from '@/api/client-portal/client-portal-api';
import {
  filterChatConversations,
  getChatDotTone,
  getChatStatusTag,
  toOpenedChat,
} from './chats-helpers';

const buildConversation = (
  overrides: Partial<ClientPortalChatConversation> = {}
): ClientPortalChatConversation => ({
  id: 'client-1',
  clientId: 'client-1',
  name: 'Brandbase',
  projectsCount: 4,
  portalStatus: { status: 'active', label: 'Active', color: 'green' },
  unreadCount: 0,
  lastMessage: null,
  lastMessageAt: null,
  lastSenderType: null,
  lastSenderName: null,
  ...overrides,
});

describe('getChatDotTone', () => {
  it('is red whenever there is something unread, even if the portal is not active', () => {
    expect(
      getChatDotTone(
        buildConversation({
          unreadCount: 2,
          portalStatus: { status: 'expired', label: 'Expired', color: 'red' },
        })
      )
    ).toBe('unread');
  });

  it('is blue for an active portal with nothing unread', () => {
    expect(getChatDotTone(buildConversation())).toBe('active');
  });

  it('is empty otherwise', () => {
    expect(
      getChatDotTone(
        buildConversation({ portalStatus: { status: 'invited', label: 'Invited', color: 'orange' } })
      )
    ).toBe('none');
  });
});

describe('getChatStatusTag', () => {
  it('tags active, expired and invited clients', () => {
    expect(getChatStatusTag(buildConversation())).toBe('active');
    expect(
      getChatStatusTag(
        buildConversation({ portalStatus: { status: 'expired', label: 'Expired', color: 'red' } })
      )
    ).toBe('expired');
    expect(
      getChatStatusTag(
        buildConversation({ portalStatus: { status: 'invited', label: 'Invited', color: 'orange' } })
      )
    ).toBe('invited');
  });

  it('shows no tag for a client that was never invited', () => {
    expect(
      getChatStatusTag(
        buildConversation({
          portalStatus: { status: 'not_invited', label: 'Not Invited', color: 'default' },
        })
      )
    ).toBeNull();
  });
});

describe('filterChatConversations', () => {
  const list = [
    buildConversation({ id: 'a', name: 'Brandbase' }),
    buildConversation({ id: 'b', name: 'Brandbase Labs' }),
    buildConversation({ id: 'c', name: 'Avant' }),
  ];

  it('returns everything for an empty query', () => {
    expect(filterChatConversations(list, '  ')).toHaveLength(3);
  });

  it('matches on the client name only, ignoring case', () => {
    expect(filterChatConversations(list, 'BRANDBASE').map(c => c.id)).toEqual(['a', 'b']);
  });

  it("does not match on the last message's text", () => {
    const withMessage = [buildConversation({ name: 'Avant', lastMessage: 'Brandbase says hi' })];
    expect(filterChatConversations(withMessage, 'brandbase')).toEqual([]);
  });
});

describe('toOpenedChat', () => {
  it('opens the conversation by client id and carries the unread state', () => {
    const opened = toOpenedChat(
      buildConversation({ id: 'client-9', clientId: 'client-9', unreadCount: 3 })
    );
    expect(opened).toMatchObject({ id: 'client-9', clientId: 'client-9', status: 'unread' });
  });
});
