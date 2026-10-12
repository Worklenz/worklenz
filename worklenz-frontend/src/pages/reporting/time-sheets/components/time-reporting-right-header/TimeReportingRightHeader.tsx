import { Button, Checkbox, Dropdown, Flex, Popover, Space, Typography } from '@/shared/antd-imports';
import { DownOutlined, SettingOutlined } from '@/shared/antd-imports';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setArchived,
  setUtilizationVisible,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';

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
  const location = useLocation();
  const { archived, utilizationVisible } = useAppSelector(
    state => state.timeReportsOverviewReducer
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Utilization summary only renders on the Members Time Sheet page, so its
  // visibility toggle only makes sense to show there.
  const isMembersTimeSheet = location.pathname.includes('time-sheet-members');

  const menuItems = exportType.map(item => ({
    key: item.key,
    label: item.label,
    onClick: () => exportFn(item.key),
  }));

  return (
    <CustomPageHeader
      title={title}
      style={{ padding: 0, marginBottom: 16 }}
      children={
        <Space wrap style={{ rowGap: 8 }}>
          <Popover
            trigger="click"
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            placement="bottomLeft"
            title={t('reportSettings', { defaultValue: 'Report Settings' })}
            content={
              <Flex vertical gap={12} style={{ minWidth: 220 }}>
                <Checkbox
                  checked={archived}
                  onChange={e => dispatch(setArchived(e.target.checked))}
                >
                  <Typography.Text>{t('includeArchivedProjects')}</Typography.Text>
                </Checkbox>
                {isMembersTimeSheet && (
                  <Checkbox
                    checked={!utilizationVisible}
                    onChange={e => dispatch(setUtilizationVisible(!e.target.checked))}
                  >
                    <Typography.Text>
                      {t('hideUtilization', { defaultValue: 'Hide Utilization' })}
                    </Typography.Text>
                  </Checkbox>
                )}
              </Flex>
            }
          >
            <Button
              icon={<SettingOutlined />}
              aria-label={t('reportSettings', { defaultValue: 'Report Settings' })}
            />
          </Popover>
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
