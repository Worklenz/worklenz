export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export type RequestStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';

export const REQUEST_STATUS_FILTER_VALUES: Array<'all' | RequestStatus> = [
  'all',
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
];
