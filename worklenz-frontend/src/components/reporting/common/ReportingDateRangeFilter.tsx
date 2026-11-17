import { memo, useState } from 'react';
import { Button, Card, Dropdown, Flex, Typography } from '@/shared/antd-imports';
import { CaretDownFilled, CheckOutlined } from '@/shared/antd-imports';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';

export interface IDateRangePreset {
  key: string;
  label: string;
  range: () => [Dayjs, Dayjs];
}

export const DATE_RANGE_PRESETS: IDateRangePreset[] = [
  {
    key: 'last_7',
    label: 'Last 7 days',
    range: () => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')],
  },
  {
    key: 'last_30',
    label: 'Last 30 days',
    range: () => [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')],
  },
  {
    key: 'this_month',
    label: 'This month',
    range: () => [dayjs().startOf('month'), dayjs().endOf('month')],
  },
  {
    key: 'last_month',
    label: 'Last month',
    range: () => [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ],
  },
  {
    key: 'last_3m',
    label: 'Last 3 months',
    range: () => [dayjs().subtract(2, 'month').startOf('month'), dayjs().endOf('month')],
  },
  {
    key: 'last_6m',
    label: 'Last 6 months',
    range: () => [dayjs().subtract(5, 'month').startOf('month'), dayjs().endOf('month')],
  },
];

interface Props {
  value?: string;
  onChange: (presetKey: string, range: [Dayjs, Dayjs]) => void;
}

const ReportingDateRangeFilter = ({ value = 'last_month', onChange }: Props) => {
  const { t } = useTranslation('reporting-all-tasks');
  const [open, setOpen] = useState(false);

  const selected =
    DATE_RANGE_PRESETS.find(p => p.key === value) ??
    DATE_RANGE_PRESETS.find(p => p.key === 'last_month')!;

  const handleSelect = (preset: IDateRangePreset) => {
    onChange(preset.key, preset.range());
    setOpen(false);
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 180 } }}>
      <Flex vertical gap={2}>
        {DATE_RANGE_PRESETS.map(preset => (
          <Flex
            key={preset.key}
            align="center"
            justify="space-between"
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              background: preset.key === value ? 'rgba(0,0,0,0.04)' : 'transparent',
            }}
            onMouseEnter={e =>
              (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')
            }
            onMouseLeave={e =>
              (e.currentTarget.style.background =
                preset.key === value ? 'rgba(0,0,0,0.04)' : 'transparent')
            }
            onClick={() => handleSelect(preset)}
          >
            <Typography.Text>{t(`datePreset_${preset.key}`, { defaultValue: preset.label })}</Typography.Text>
            {preset.key === value && (
              <CheckOutlined style={{ color: '#1890ff', fontSize: 12 }} />
            )}
          </Flex>
        ))}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t(`datePreset_${selected.key}`, { defaultValue: selected.label })}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(ReportingDateRangeFilter);
