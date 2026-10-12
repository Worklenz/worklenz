import axios from 'axios';
import dayjs from 'dayjs';

import { IProjectRelease, ReleaseConfidence } from '@/types/project/projectRelease.types';

/** Days before the target date during which an incomplete release is flagged as at risk. */
const AT_RISK_WINDOW_DAYS = 7;
/** Completion (%) a release should reach before entering the at-risk window. */
const AT_RISK_COMPLETION_THRESHOLD = 80;

export const getReleaseProgress = (release: IProjectRelease): number => {
  if (!release.issue_count) return release.status === 'released' ? 100 : 0;
  return Math.round((release.done_issue_count / release.issue_count) * 100);
};

export const getReleaseConfidence = (release: IProjectRelease): ReleaseConfidence => {
  if (release.status === 'released') return 'released';
  if (!release.issue_count || !release.target_date) return 'planning';

  const progress = getReleaseProgress(release);
  if (progress === 100) return 'onTrack';

  const daysUntilTarget = dayjs(release.target_date).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (daysUntilTarget < 0) return 'overdue';

  const isInRiskWindow =
    daysUntilTarget <= AT_RISK_WINDOW_DAYS && progress < AT_RISK_COMPLETION_THRESHOLD;
  if (isInRiskWindow || release.open_critical_bug_count > 0 || release.blocked_count > 0) {
    return 'atRisk';
  }
  return 'onTrack';
};

export const formatReleaseDate = (date: string | null): string | null =>
  date ? dayjs(date).format('MMM D, YYYY') : null;

/** Error responses from the API are already announced by the api-client interceptor. */
export const isAnnouncedApiError = (error: unknown): boolean =>
  axios.isAxiosError(error) && !!error.response;

/** Suggests the next minor version (v2.1.0 → v2.2.0) based on existing release names. */
export const suggestNextReleaseName = (releases: IProjectRelease[]): string => {
  const versions = releases
    .map(release => SEMVER_PATTERN.exec(release.name.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(match => ({ major: Number(match[1]), minor: Number(match[2]) }));
  if (!versions.length) return DEFAULT_RELEASE_NAME;

  const latest = versions.reduce((highest, version) =>
    version.major > highest.major ||
    (version.major === highest.major && version.minor > highest.minor)
      ? version
      : highest
  );
  return `v${latest.major}.${latest.minor + 1}.0`;
};

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/i;
const DEFAULT_RELEASE_NAME = 'v1.0.0';

export const RELEASE_NAME_MAX_LENGTH = 50;
export const RELEASE_DESCRIPTION_MAX_LENGTH = 1000;
