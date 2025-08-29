import React from 'react';
import { Button, Checkbox, Dropdown, Space, Typography } from '@/shared/antd-imports';
import { DownOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setArchived } from '@/features/reporting/time-reports/time-reports-overview.slice';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';

interface headerState {
  title: string;
  exportType: Array<{ key: string; label: string }>;
  export: (key: string) => void;
}

const TimeReportingRightHeader: React.FC<headerState> = ({
  title,
  exportType,
  export: exportFn,
}) => {
  const { t } = useTranslation('time-report');
  const dispatch = useAppDispatch();
  const { archived } = useAppSelector(state => state.timeReportsOverviewReducer);

  const menuItems = exportType.map(item => ({
    key: item.key,
    label: item.label,
    onClick: () => exportFn(item.key),
  }));

  return (
    <CustomPageHeader
      title={title}
      children={
        <Space>
          <Button>
            <Checkbox checked={archived} onChange={e => dispatch(setArchived(e.target.checked))}>
              <Typography.Text>{t('includeArchivedProjects')}</Typography.Text>
            </Checkbox>
          </Button>
          <TimeWiseFilter />
          <Dropdown menu={{ items: menuItems }}>
            <Button type="primary" icon={<DownOutlined />} iconPosition="end">
              {t('export')}
            </Button>
          </Dropdown>
        </Space>
      }
    />
  );
};

export default TimeReportingRightHeader;
