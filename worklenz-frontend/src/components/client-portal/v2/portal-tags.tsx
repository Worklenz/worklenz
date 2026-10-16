import React from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOutlined, LockOutlined } from '@/shared/antd-imports';
import type {
  ApprovalStatus,
  ChangeRequestPriority,
  ChangeRequestStatus,
  ClientProjectStatus,
  ClientRole,
  MilestoneStatus,
  PortalVisibility,
} from '@/types/client-portal/v2';
import { StatusTag, type StatusTone } from './StatusTag';

const NS = 'client-portal-v2';

// Label key + default text per value. Keys live in public/locales/<lng>/client-portal-v2.json.
interface TagSpec {
  tone: StatusTone;
  key: string;
  defaultValue: string;
}

const ROLE_TAGS: Record<ClientRole, TagSpec> = {
  admin: { tone: 'purple', key: 'roleAdmin', defaultValue: 'Client Admin' },
  member: { tone: 'blue', key: 'roleMember', defaultValue: 'Client Member' },
  viewer: { tone: 'gray', key: 'roleViewer', defaultValue: 'Client Viewer' },
};

const APPROVAL_TAGS: Record<ApprovalStatus, TagSpec> = {
  draft: { tone: 'gray', key: 'approvalDraft', defaultValue: 'Draft' },
  awaiting: { tone: 'orange', key: 'approvalAwaiting', defaultValue: 'Awaiting Approval' },
  approved: { tone: 'green', key: 'approvalApproved', defaultValue: 'Approved' },
  changes_requested: {
    tone: 'red',
    key: 'approvalChangesRequested',
    defaultValue: 'Changes Requested',
  },
  cancelled: { tone: 'gray', key: 'approvalCancelled', defaultValue: 'Cancelled' },
};

const CHANGE_REQUEST_TAGS: Record<ChangeRequestStatus, TagSpec> = {
  submitted: { tone: 'blue', key: 'crSubmitted', defaultValue: 'Submitted' },
  under_review: { tone: 'orange', key: 'crUnderReview', defaultValue: 'Under Review' },
  more_info: { tone: 'red', key: 'crMoreInfo', defaultValue: 'More Information Required' },
  approved: { tone: 'green', key: 'crApproved', defaultValue: 'Approved' },
  rejected: { tone: 'gray', key: 'crRejected', defaultValue: 'Rejected' },
  in_progress: { tone: 'purple', key: 'crInProgress', defaultValue: 'In Progress' },
  completed: { tone: 'green', key: 'crCompleted', defaultValue: 'Completed' },
  cancelled: { tone: 'gray', key: 'crCancelled', defaultValue: 'Cancelled' },
};

const MILESTONE_TAGS: Record<MilestoneStatus, TagSpec> = {
  upcoming: { tone: 'gray', key: 'milestoneUpcoming', defaultValue: 'Upcoming' },
  in_progress: { tone: 'blue', key: 'milestoneInProgress', defaultValue: 'In Progress' },
  completed: { tone: 'green', key: 'milestoneCompleted', defaultValue: 'Completed' },
  delayed: { tone: 'orange', key: 'milestoneDelayed', defaultValue: 'Delayed' },
};

const PROJECT_STATUS_TAGS: Record<ClientProjectStatus, TagSpec> = {
  on_track: { tone: 'green', key: 'projectOnTrack', defaultValue: 'On track' },
  at_risk: { tone: 'orange', key: 'projectAtRisk', defaultValue: 'At risk' },
  on_hold: { tone: 'gray', key: 'projectOnHold', defaultValue: 'On hold' },
  completed: { tone: 'blue', key: 'projectCompleted', defaultValue: 'Completed' },
};

const PRIORITY_TAGS: Record<ChangeRequestPriority, TagSpec> = {
  high: { tone: 'red', key: 'priorityHigh', defaultValue: 'High' },
  medium: { tone: 'orange', key: 'priorityMedium', defaultValue: 'Medium' },
  low: { tone: 'gray', key: 'priorityLow', defaultValue: 'Low' },
};

const SpecTag = ({ spec }: { spec: TagSpec }) => {
  const { t } = useTranslation(NS);
  return <StatusTag tone={spec.tone}>{t(spec.key, { defaultValue: spec.defaultValue })}</StatusTag>;
};

export const RoleTag = ({ role }: { role: ClientRole }) => <SpecTag spec={ROLE_TAGS[role]} />;

export const ApprovalStatusTag = ({ status }: { status: ApprovalStatus }) => (
  <SpecTag spec={APPROVAL_TAGS[status]} />
);

export const ChangeRequestStatusTag = ({ status }: { status: ChangeRequestStatus }) => (
  <SpecTag spec={CHANGE_REQUEST_TAGS[status]} />
);

export const MilestoneStatusTag = ({ status }: { status: MilestoneStatus }) => (
  <SpecTag spec={MILESTONE_TAGS[status]} />
);

export const ClientProjectStatusTag = ({ status }: { status: ClientProjectStatus }) => (
  <SpecTag spec={PROJECT_STATUS_TAGS[status]} />
);

export const PriorityTag = ({ priority }: { priority: ChangeRequestPriority }) => (
  <SpecTag spec={PRIORITY_TAGS[priority]} />
);

/** Client visible (green, eye) or Internal only (gray, lock). Internal Only is the default everywhere. */
export const VisibilityTag = ({ visibility }: { visibility: PortalVisibility }) => {
  const { t } = useTranslation(NS);
  return visibility === 'client' ? (
    <StatusTag tone="green" icon={<EyeOutlined />}>
      {t('visibilityClient', { defaultValue: 'Client visible' })}
    </StatusTag>
  ) : (
    <StatusTag tone="gray" icon={<LockOutlined />}>
      {t('visibilityInternal', { defaultValue: 'Internal only' })}
    </StatusTag>
  );
};
