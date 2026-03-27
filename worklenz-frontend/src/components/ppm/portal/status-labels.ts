/**
 * Client-facing status labels and colors.
 * Internal statuses are mapped to friendly labels per the design spec's
 * 3-tier visibility model.
 */

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  incoming:        { label: 'Submitted',       color: '#d9d9d9', bgColor: '#fafafa' },
  queued:          { label: 'Submitted',       color: '#8c8c8c', bgColor: '#f5f5f5' },
  in_progress:     { label: 'In Progress',     color: '#1890ff', bgColor: '#e6f7ff' },
  internal_review: { label: 'In Progress',     color: '#1890ff', bgColor: '#e6f7ff' },
  client_review:   { label: 'Awaiting Review', color: '#fa8c16', bgColor: '#fff7e6' },
  revision:        { label: 'Revision',        color: '#f5222d', bgColor: '#fff1f0' },
  approved:        { label: 'Approved',        color: '#52c41a', bgColor: '#f6ffed' },
  done:            { label: 'Done',            color: '#52c41a', bgColor: '#f6ffed' },
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] || { label: status, color: '#8c8c8c', bgColor: '#f5f5f5' };
}

export function getClientLabel(status: string): string {
  return getStatusConfig(status).label;
}
