import type { AuditEvent } from '@/types/client-portal/v2';

export interface TargetDetail {
  /** i18n key under the audit namespace, e.g. `target.ref`. */
  key: string;
  defaultValue: string;
  value: string;
}

const SEPARATOR = ' · ';

const detail = (key: string, defaultValue: string, value: string): TargetDetail => ({ key: `target.${key}`, defaultValue, value });

/**
 * Splits the stored one-line target label ("AP-12 · Homepage design") into labelled parts so the audit
 * table can show "Ref: AP-12" and "Title: Homepage design". Unknown shapes come back as one "Target" part.
 */
export const parseAuditTarget = (event: Pick<AuditEvent, 'target' | 'target_type' | 'event'>): TargetDetail[] => {
  const label = event.target.trim();
  if (!label) return [];
  const parts = label.split(SEPARATOR).map(part => part.trim());

  switch (event.target_type) {
    case 'approval':
      return parts.length > 1
        ? [detail('ref', 'Ref', parts[0]), detail('approvalTitle', 'Approval', parts.slice(1).join(SEPARATOR))]
        : [detail('ref', 'Ref', parts[0])];
    case 'change_request': {
      const [ref, ...rest] = parts;
      const text = rest.join(SEPARATOR);
      if (!text) return [detail('ref', 'Ref', ref)];
      return text.includes('→')
        ? [detail('ref', 'Ref', ref), detail('statusChange', 'Status', text)]
        : [detail('ref', 'Ref', ref), detail('crTitle', 'Request', text)];
    }
    case 'file': {
      const bare = label.replace(/^File:\s*/, '');
      const match = bare.match(/^(.*)\s\(v(\d+)\)$/);
      return match
        ? [detail('file', 'File', match[1]), detail('version', 'Version', `v${match[2]}`)]
        : [detail('file', 'File', bare)];
    }
    case 'milestone':
      return [detail('milestone', 'Milestone', label.replace(/^Milestone:\s*/, ''))];
    case 'task':
      return [detail('task', 'Task', label.replace(/^Task:\s*/, ''))];
    case 'project':
      return parts.length > 1
        ? [detail('project', 'Project', parts[0]), detail('client', 'Client', parts.slice(1).join(SEPARATOR))]
        : [detail('project', 'Project', parts[0])];
    case 'client_user': {
      const result: TargetDetail[] = [detail('name', 'Name', parts[0])];
      const isProjectEvent = event.event.startsWith('Project access');
      parts.slice(1).forEach((part, index, rest) => {
        if (part.includes('@')) result.push(detail('email', 'Email', part));
        else if (isProjectEvent) result.push(detail('project', 'Project', part));
        else if (index === rest.length - 1 && rest.length > 1) result.push(detail('role', 'Role', part));
        else result.push(detail('client', 'Client', part));
      });
      return result;
    }
    default:
      return [detail('generic', 'Target', label)];
  }
};
