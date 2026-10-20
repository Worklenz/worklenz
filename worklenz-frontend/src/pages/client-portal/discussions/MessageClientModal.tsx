import { useNavigate } from 'react-router-dom';
import { portalPaths } from '../portal-paths';
import { NewDiscussionModal } from './NewDiscussionModal';

/** Who a "Message" shortcut on a client or client user row is for. */
export interface MessageTarget {
  organizationId: string;
  /** Limits the project choice, e.g. to the projects one client user can open. */
  projectIds?: string[];
  /** Client users to notify from the start. */
  recipientIds?: string[];
}

interface MessageClientModalProps {
  target: MessageTarget;
  onClose: () => void;
}

/** The new-discussion dialog opened from a client or client user, which then opens the thread it started. */
export const MessageClientModal = ({ target, onClose }: MessageClientModalProps) => {
  const navigate = useNavigate();

  return (
    <NewDiscussionModal
      organizationId={target.organizationId}
      restrictToProjectIds={target.projectIds}
      initialRecipientIds={target.recipientIds}
      onClose={onClose}
      onCreated={thread => navigate(portalPaths.discussion(thread.id))}
    />
  );
};
