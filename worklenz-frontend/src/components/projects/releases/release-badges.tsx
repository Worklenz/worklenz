import { useTranslation } from 'react-i18next';
import { Tag, Tooltip, theme } from '@/shared/antd-imports';
import type { GlobalToken } from 'antd';

import { ReleaseConfidence, ReleaseStatus } from '@/types/project/projectRelease.types';

export const ReleaseStatusTag = ({ status }: { status: ReleaseStatus }) => {
  const { t } = useTranslation('project-view');
  const isReleased = status === 'released';
  return (
    <Tag
      bordered={false}
      color={isReleased ? 'success' : 'default'}
      className="m-0 rounded-full px-2 text-[11px] font-bold leading-[20px]"
    >
      {isReleased
        ? t('releaseStatusReleased', { defaultValue: 'Released' })
        : t('releaseStatusUnreleased', { defaultValue: 'Unreleased' })}
    </Tag>
  );
};

export const ReleaseConfidenceLabel = ({ confidence }: { confidence: ReleaseConfidence }) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const { labelKey, defaultLabel, tooltipKey, defaultTooltip } = CONFIDENCE_COPY[confidence];
  return (
    <Tooltip title={t(tooltipKey, { defaultValue: defaultTooltip })}>
      <span
        className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
        style={{ color: getConfidenceColor(confidence, token) }}
      >
        <span
          aria-hidden="true"
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: getConfidenceColor(confidence, token) }}
        />
        {t(labelKey, { defaultValue: defaultLabel })}
      </span>
    </Tooltip>
  );
};

const getConfidenceColor = (confidence: ReleaseConfidence, token: GlobalToken): string => {
  switch (confidence) {
    case 'released':
    case 'onTrack':
      return token.colorSuccess;
    case 'atRisk':
      return token.colorWarning;
    case 'overdue':
      return token.colorError;
    default:
      return token.colorTextSecondary;
  }
};

const CONFIDENCE_COPY: Record<
  ReleaseConfidence,
  { labelKey: string; defaultLabel: string; tooltipKey: string; defaultTooltip: string }
> = {
  released: {
    labelKey: 'releaseConfidenceReleased',
    defaultLabel: 'Released',
    tooltipKey: 'releaseConfidenceReleasedTooltip',
    defaultTooltip: 'This version has shipped.',
  },
  planning: {
    labelKey: 'releaseConfidencePlanning',
    defaultLabel: 'Planning',
    tooltipKey: 'releaseConfidencePlanningTooltip',
    defaultTooltip: 'Add work items and a target date to track confidence.',
  },
  overdue: {
    labelKey: 'releaseConfidenceOverdue',
    defaultLabel: 'Overdue',
    tooltipKey: 'releaseConfidenceOverdueTooltip',
    defaultTooltip: 'The target date has passed with work still open.',
  },
  atRisk: {
    labelKey: 'releaseConfidenceAtRisk',
    defaultLabel: 'At risk',
    tooltipKey: 'releaseConfidenceAtRiskTooltip',
    defaultTooltip:
      'Open critical bugs, blocked work, or less than 80% complete within a week of the target.',
  },
  onTrack: {
    labelKey: 'releaseConfidenceOnTrack',
    defaultLabel: 'On track',
    tooltipKey: 'releaseConfidenceOnTrackTooltip',
    defaultTooltip: 'No critical bugs or blockers and progress is on pace.',
  },
};
