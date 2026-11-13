import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Segmented, Tooltip, Button, RetweetOutlined, theme } from '@/shared/antd-imports';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import './reporting-mode-paddle.css';

/** `custom` = analytics (new), `classic` = legacy reporting (old). */
export type ReportingMode = 'custom' | 'classic';

export const CLASSIC_REPORTING_PATH = '/worklenz/reporting/overview';
export const REPORTING_MODE_STORAGE_KEY = 'worklenz.reportingMode';

interface ReportingModePaddleProps {
  /** Which reporting tree is currently visible. */
  mode: ReportingMode;
  /**
   * `wide` — Segmented paddle (analytics sidebar ~248px).
   * `narrow` — stacked Advanced/Classic buttons (classic NavRail ~64px).
   */
  density?: 'wide' | 'narrow';
  /** When true with wide density, show a compact switch instead of Segmented. */
  collapsed?: boolean;
  className?: string;
}

const persistMode = (mode: ReportingMode) => {
  try {
    localStorage.setItem(REPORTING_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
};

const normalizeStoredMode = (value: string | null): ReportingMode | null => {
  if (value === 'custom' || value === 'new') return 'custom';
  if (value === 'classic' || value === 'old') return 'classic';
  return null;
};

export const readReportingModePreference = (): ReportingMode | null => {
  try {
    return normalizeStoredMode(localStorage.getItem(REPORTING_MODE_STORAGE_KEY));
  } catch {
    // Ignore storage failures
  }
  return null;
};

/**
 * Sidebar paddle to switch between classic and custom (analytics) reporting.
 * Navigation only — APIs stay on their existing separate endpoints.
 */
export const ReportingModePaddle: React.FC<ReportingModePaddleProps> = ({
  mode,
  density = 'wide',
  collapsed = false,
  className,
}) => {
  const { t } = useTranslation('reporting-sidebar');
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const advancedLabel = t('modeAdvanced', { defaultValue: 'Advanced' });
  const classicLabel = t('modeClassic', { defaultValue: 'Classic' });
  const ariaLabel = t('modePaddleAria', { defaultValue: 'Switch reporting version' });

  const options = useMemo(
    () => [
      { label: advancedLabel, value: 'custom' as const },
      { label: classicLabel, value: 'classic' as const },
    ],
    [advancedLabel, classicLabel]
  );

  const goToMode = useCallback(
    (next: ReportingMode) => {
      if (next === mode) return;
      persistMode(next);
      navigate(next === 'custom' ? ANALYTICS_BASE_PATH : CLASSIC_REPORTING_PATH);
    },
    [mode, navigate]
  );

  if (density === 'narrow') {
    return (
      <div
        className={`reporting-mode-paddle-narrow${className ? ` ${className}` : ''}`}
        role="group"
        aria-label={ariaLabel}
      >
        {options.map(option => {
          const isActive = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`reporting-mode-paddle-narrow-btn${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              onClick={() => goToMode(option.value)}
              style={{
                color: isActive ? token.colorPrimary : token.colorTextSecondary,
                background: isActive ? token.colorPrimaryBg : 'transparent',
                borderColor: isActive ? token.colorPrimaryBorder : 'transparent',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (collapsed) {
    const otherMode: ReportingMode = mode === 'custom' ? 'classic' : 'custom';
    const otherLabel = otherMode === 'custom' ? advancedLabel : classicLabel;
    const switchLabel = t('modeSwitchTo', {
      defaultValue: 'Switch to {{mode}}',
      mode: otherLabel,
    });

    return (
      <div
        className={className}
        style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}
      >
        <Tooltip title={switchLabel} placement="right">
          <Button
            type="text"
            size="small"
            aria-label={switchLabel}
            icon={<RetweetOutlined />}
            onClick={() => goToMode(otherMode)}
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={className} style={{ padding: '0 4px 10px' }}>
      <Segmented
        block
        size="small"
        value={mode}
        options={options}
        onChange={value => goToMode(value as ReportingMode)}
        aria-label={ariaLabel}
      />
    </div>
  );
};

export default ReportingModePaddle;
