export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export type ServiceStatus = 'active' | 'inactive';

export const SERVICE_STATUS_FILTER_VALUES: Array<'all' | ServiceStatus> = [
  'all',
  'active',
  'inactive',
];

export const DEFAULT_SERVICE_CATEGORIES = ['Digital', 'Marketing', 'Branding', 'Content', 'Other'];

export const DEFAULT_SERVICE_BILLING_TYPES = ['Fixed', 'Recurring', 'Package'];
