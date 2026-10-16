import type { TFunction } from 'i18next';
import type { ApproverOption } from '@/types/client-portal/v2';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Client Admin',
  member: 'Client Member',
  viewer: 'Client Viewer',
};

/** The option list for the Approvers select: every active user of the client, with their role. */
export const buildApproverOptions = (t: TFunction, approvers: ApproverOption[]) =>
  approvers.map(approver => ({
    value: approver.id,
    label: t('create.approverOption', {
      name: approver.name,
      email: approver.email,
      role: t(`create.role.${approver.role}`, { defaultValue: ROLE_LABELS[approver.role] ?? approver.role }),
      defaultValue: '{{name}} · {{email}} · {{role}}',
    }),
  }));
