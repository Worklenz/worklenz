import { Flex, Tooltip, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

interface EstimatedVsActualCellProps {
  actualTime: number | null;
  actualTimeString: string | null;
  estimatedTime: number | null;
  estimatedTimeString: string | null;
}

const BAR_COLORS = {
  estimated: '#7a84df',
  actual: '#c191cc',
} as const;

const BAR_HEIGHT = 16;
const MAX_BAR_WIDTH = 200;

const EstimatedVsActualCell = ({
  actualTime,
  actualTimeString,
  estimatedTime,
  estimatedTimeString,
}: EstimatedVsActualCellProps) => {
  const { t } = useTranslation('reporting-projects');
  const { token } = theme.useToken();

  const estimatedValue = estimatedTime ?? 0;
  const actualValue = actualTime ?? 0;

  if (!estimatedValue && !actualValue) {
    return <Typography.Text>-</Typography.Text>;
  }

  const maxValue = Math.max(estimatedValue, actualValue, 1);
  const estimatedPercent = estimatedValue ? (estimatedValue / maxValue) * 100 : 0;
  const actualPercent = actualValue ? (actualValue / maxValue) * 100 : 0;

  const estimatedLabel = `${t('estimatedText', { defaultValue: 'Estimated' })}: ${estimatedTimeString ?? '-'}`;
  const actualLabel = `${t('actualText', { defaultValue: 'Actual' })}: ${actualTimeString ?? '-'}`;

  const renderBar = (label: string, percent: number, backgroundColor: string) => (
    <Tooltip title={label}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: BAR_HEIGHT,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${Math.max(percent, percent > 0 ? 8 : 0)}%`,
            height: '100%',
            borderRadius: 4,
            backgroundColor,
          }}
        />
        <Typography.Text
          style={{
            position: 'absolute',
            insetInlineStart: 8,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            fontSize: 12,
            fontWeight: 500,
            color: token.colorText,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {label}
        </Typography.Text>
      </div>
    </Tooltip>
  );

  return (
    <Flex vertical gap={4} style={{ width: '100%', maxWidth: MAX_BAR_WIDTH }}>
      {renderBar(estimatedLabel, estimatedPercent, BAR_COLORS.estimated)}
      {renderBar(actualLabel, actualPercent, BAR_COLORS.actual)}
    </Flex>
  );
};

export default EstimatedVsActualCell;
