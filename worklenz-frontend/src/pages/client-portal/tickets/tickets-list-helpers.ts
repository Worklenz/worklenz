export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketBuiltInStatus = 'open' | 'in_progress' | 'resolved';

export const TICKET_BUILT_IN_STATUSES: TicketBuiltInStatus[] = ['open', 'in_progress', 'resolved'];

// Maps a built-in status to its client-portal-common i18n key + English fallback, since
// 'open'/'resolved' aren't otherwise defined in that namespace (unlike 'inProgress', which
// Requests already established there).
export const TICKET_BUILT_IN_STATUS_I18N: Record<TicketBuiltInStatus, { key: string; defaultValue: string }> = {
  open: { key: 'ticketStatusOpen', defaultValue: 'Open' },
  in_progress: { key: 'inProgress', defaultValue: 'In Progress' },
  resolved: { key: 'ticketStatusResolved', defaultValue: 'Resolved' },
};

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high'];

export const ticketPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'high':
      return 'red';
    case 'medium':
      return 'orange';
    case 'low':
      return 'green';
    default:
      return 'default';
  }
};

export const ticketStatusColor = (status: string): string => {
  switch (status) {
    case 'open':
      return 'default';
    case 'in_progress':
      return 'processing';
    case 'resolved':
      return 'success';
    default:
      return 'blue';
  }
};
