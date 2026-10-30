import { Tag } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

// One vocabulary for every status shown to a client (umbrella #2520, "Status vocabulary").
// Draft approvals are never shown, so there is no entry for them.
type StatusMap = Record<string, { label: string; color: string }>;

const STATUS_MAPS = {
  approval: {
    awaiting: { label: 'Awaiting Approval', color: 'orange' },
    approved: { label: 'Approved', color: 'green' },
    changes_requested: { label: 'Changes Requested', color: 'red' },
    cancelled: { label: 'Cancelled', color: 'default' },
  },
  changeRequest: {
    submitted: { label: 'Submitted', color: 'blue' },
    under_review: { label: 'Under Review', color: 'gold' },
    more_info: { label: 'More Information Required', color: 'red' },
    approved: { label: 'Approved', color: 'green' },
    rejected: { label: 'Rejected', color: 'red' },
    in_progress: { label: 'In Progress', color: 'processing' },
    completed: { label: 'Completed', color: 'green' },
    cancelled: { label: 'Cancelled', color: 'default' },
  },
  milestone: {
    upcoming: { label: 'Upcoming', color: 'default' },
    in_progress: { label: 'In Progress', color: 'processing' },
    completed: { label: 'Completed', color: 'green' },
    delayed: { label: 'Delayed', color: 'orange' },
  },
  task: {
    not_started: { label: 'Not started', color: 'default' },
    in_progress: { label: 'In progress', color: 'processing' },
    done: { label: 'Done', color: 'green' },
  },
  project: {
    on_track: { label: 'On track', color: 'green' },
    at_risk: { label: 'At risk', color: 'orange' },
    on_hold: { label: 'On hold', color: 'default' },
    completed: { label: 'Completed', color: 'blue' },
  },
  priority: {
    low: { label: 'Low', color: 'default' },
    medium: { label: 'Medium', color: 'blue' },
    high: { label: 'High', color: 'red' },
  },
  role: {
    admin: { label: 'Client Admin', color: 'purple' },
    member: { label: 'Client Member', color: 'blue' },
    viewer: { label: 'Client Viewer', color: 'default' },
  },
  user: {
    Active: { label: 'Active', color: 'green' },
    Invited: { label: 'Invited', color: 'blue' },
    Deactivated: { label: 'Deactivated', color: 'default' },
    Deleted: { label: 'Account deleted', color: 'red' },
  },
} satisfies Record<string, StatusMap>;

export type StatusKind = keyof typeof STATUS_MAPS;

interface StatusTagProps {
  kind: StatusKind;
  status: string;
}

export const StatusTag = ({ kind, status }: StatusTagProps) => {
  const { t } = useTranslation();
  const entry = (STATUS_MAPS[kind] as StatusMap)[status];
  if (!entry) return <Tag>{status}</Tag>;
  return <Tag color={entry.color}>{t(`status.${kind}.${status}`, { defaultValue: entry.label })}</Tag>;
};
