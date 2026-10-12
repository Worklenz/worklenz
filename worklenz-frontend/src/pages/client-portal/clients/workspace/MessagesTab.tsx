import RequestChatWrapper from '../../requests/request-details/request-chat-wrapper';

interface MessagesTabProps {
  clientId: string;
  clientName: string;
}

// The chat needs a parent with a height: it fills it and scrolls its own messages.
const CHAT_HEIGHT = 560;

/**
 * Messages with this client. It is the same conversation, from the same messages, as the global
 * Chats inbox, only scoped to one client, so the two can never disagree.
 */
export const MessagesTab = ({ clientId, clientName }: MessagesTabProps) => (
  <div style={{ height: CHAT_HEIGHT }}>
    <RequestChatWrapper clientId={clientId} clientName={clientName} />
  </div>
);
