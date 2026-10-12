import React, { memo } from 'react';
import { Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

type EstimatedVsActualCellProps = {
  actualTime: number | null;
  actualTimeString: string | null;
  estimatedTime: number | null;
  estimatedTimeString: string | null;
};

const EstimatedVsActualCell = memo(({
  actualTime,
  actualTimeString,
  estimatedTime,
  estimatedTimeString,
}: EstimatedVsActualCellProps) => {
  const { t } = useTranslation('reporting-projects');

  if (!actualTime && !estimatedTime) {
    return <Typography.Text>-</Typography.Text>;
  }

  const est = Math.max(0, estimatedTime || 0);
  const act = Math.max(0, actualTime || 0);
  const max = Math.max(est, act, 1);
  const estWidth = `${Math.min(100, Math.round((est / max) * 100))}%`;
  const actWidth = `${Math.min(100, Math.round((act / max) * 100))}%`;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '200px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ position: 'relative', height: '18px', width: '100%', display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: estWidth,
            backgroundColor: '#7a84df',
            borderRadius: '2px',
          }}
        />
        <Typography.Text
          style={{
            position: 'relative',
            fontSize: 12,
            fontWeight: 500,
            paddingLeft: 6,
            whiteSpace: 'nowrap',
          }}
        >
          {`${t('estimatedText', { defaultValue: 'Estimated' })}: ${estimatedTimeString ?? '-'}`}
        </Typography.Text>
      </div>
      <div style={{ position: 'relative', height: '18px', width: '100%', display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: actWidth,
            backgroundColor: '#c191cc',
            borderRadius: '2px',
          }}
        />
        <Typography.Text
          style={{
            position: 'relative',
            fontSize: 12,
            fontWeight: 500,
            paddingLeft: 6,
            whiteSpace: 'nowrap',
          }}
        >
          {`${t('actualText', { defaultValue: 'Actual' })}: ${actualTimeString ?? '-'}`}
        </Typography.Text>
      </div>
    </div>
  );
});

export default EstimatedVsActualCell;
