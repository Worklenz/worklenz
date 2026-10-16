import React from 'react';
import { Modal, Typography, notification } from '@/shared/antd-imports';
import { IProjectTemplateApplySkip } from '@/types/project/projectTemplate.types';

const { Text, Paragraph } = Typography;

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface SkipGroup {
  type: IProjectTemplateApplySkip['type'];
  count: number;
  details: string[];
}

export const groupTemplateImportSkips = (
  skips: IProjectTemplateApplySkip[] | null | undefined
): SkipGroup[] => {
  if (!skips?.length) return [];

  const map = new Map<IProjectTemplateApplySkip['type'], SkipGroup>();
  for (const skip of skips) {
    const existing = map.get(skip.type);
    const detail = skip.detail?.trim() || skip.reason;
    if (existing) {
      existing.count += 1;
      if (detail && existing.details.length < 8) existing.details.push(detail);
    } else {
      map.set(skip.type, {
        type: skip.type,
        count: 1,
        details: detail ? [detail] : [],
      });
    }
  }
  return Array.from(map.values());
};

const groupLabel = (type: IProjectTemplateApplySkip['type'], count: number, t: TranslateFn): string => {
  switch (type) {
    case 'assignee':
      return t('skipAssignees', {
        defaultValue: '{{count}} assignee(s) skipped',
        count,
      });
    case 'project_manager':
      return t('skipProjectManager', {
        defaultValue: 'Project manager adjusted',
      });
    case 'dependency':
      return t('skipDependencies', {
        defaultValue: '{{count}} dependenc(ies) skipped',
        count,
      });
    case 'recurrence':
      return t('skipRecurrence', {
        defaultValue: '{{count}} recurrence rule(s) skipped',
        count,
      });
    case 'rate_card_role':
      return t('skipRateCard', {
        defaultValue: '{{count}} rate card role(s) skipped',
        count,
      });
    case 'category':
      return t('skipCategory', {
        defaultValue: 'Category skipped',
      });
    case 'plan_gated':
      return t('skipPlanGated', {
        defaultValue: 'Some plan-gated settings were skipped',
      });
    default:
      return t('skipOther', {
        defaultValue: '{{count}} other item(s) skipped',
        count,
      });
  }
};

/** Short one-line summary of apply skips (toast description). */
export const summarizeTemplateImportSkips = (
  skips: IProjectTemplateApplySkip[] | null | undefined,
  t: TranslateFn
): string | null => {
  const groups = groupTemplateImportSkips(skips);
  if (!groups.length) return null;

  const parts = groups.map(g => groupLabel(g.type, g.count, t));
  return t('importSkipsSummary', {
    defaultValue: 'Project created with notes: {{details}}',
    details: parts.join('; '),
  });
};

const SkipDetailsContent: React.FC<{
  groups: SkipGroup[];
  t: TranslateFn;
}> = ({ groups, t }) => (
  <div>
    <Paragraph style={{ marginBottom: 12 }}>
      <Text>
        {t('importPartialBody', {
          defaultValue:
            'The project was created successfully, but some template items could not be applied.',
        })}
      </Text>
    </Paragraph>
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {groups.map(group => (
        <li key={group.type} style={{ marginBottom: 8 }}>
          <Text strong>{groupLabel(group.type, group.count, t)}</Text>
          {group.details.length > 0 && (
            <ul style={{ marginTop: 4, paddingLeft: 16 }}>
              {group.details.map((detail, index) => (
                <li key={`${group.type}-${index}`}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {detail}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  </div>
);

export interface PresentCustomTemplateImportResultArgs {
  t: TranslateFn;
  projectId: string;
  skips?: IProjectTemplateApplySkip[] | null;
  /** Called before navigation (e.g. close modals). */
  onBeforeNavigate?: () => void;
  navigate: (path: string) => void;
  /**
   * When true, skip navigation (caller handles it — e.g. open_settings or
   * onProjectCreated callback). Still shows success/skip feedback.
   */
  skipNavigation?: boolean;
  /** Optional path override. Defaults to project tasks list. */
  navigatePath?: string;
}

/**
 * Task-cloning-style result UX:
 * - success toast always
 * - warning toast for a few skips
 * - warning modal with details when many skips
 * - navigate to the new project
 */
export const presentCustomTemplateImportResult = ({
  t,
  projectId,
  skips,
  onBeforeNavigate,
  navigate,
  skipNavigation = false,
  navigatePath,
}: PresentCustomTemplateImportResultArgs): void => {
  notification.success({
    message: t('importSuccess', {
      defaultValue: 'Template imported successfully',
    }),
    placement: 'topRight',
    style: { borderRadius: '4px' },
  });

  const groups = groupTemplateImportSkips(skips);
  const summary = summarizeTemplateImportSkips(skips, t);

  if (groups.length > 0 && summary) {
    const totalSkips = groups.reduce((sum, g) => sum + g.count, 0);

    // Match Task Cloning: success + warning (not silent info)
    notification.warning({
      message: t('importPartialTitle', {
        defaultValue: 'Some template items were skipped',
      }),
      description: summary,
      placement: 'topRight',
      duration: 10,
      style: { borderRadius: '4px' },
    });

    // Expandable detail modal when there is more to show
    if (totalSkips > 2) {
      Modal.warning({
        title: t('importPartialTitle', {
          defaultValue: 'Some template items were skipped',
        }),
        content: <SkipDetailsContent groups={groups} t={t} />,
        okText: t('importPartialOk', { defaultValue: 'Got it' }),
        centered: true,
        width: 480,
      });
    }
  }

  onBeforeNavigate?.();

  if (!skipNavigation && projectId) {
    navigate(
      navigatePath ||
        `/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list`
    );
  }
};
