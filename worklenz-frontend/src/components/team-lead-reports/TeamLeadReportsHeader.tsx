import React from 'react';
import { Button, Dropdown, Space, Typography } from '@/shared/antd-imports';
import { DownOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';

interface TeamLeadReportsHeaderProps {
  title: string;
  exportType: Array<{ key: string; label: string }>;
  export: (key: string) => void;
}

const TeamLeadReportsHeader: React.FC<TeamLeadReportsHeaderProps> = ({
  title,
  exportType,
  export: exportFn,
}) => {
  const { t } = useTranslation('team-lead-reports');

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
          <Dropdown menu={{ items: menuItems }}>
            <Button type="primary" icon={<DownOutlined />} iconPosition="end">
              {t('export', { defaultValue: 'Export' })}
            </Button>
          </Dropdown>
        </Space>
      }
    />
  );
};

export default TeamLeadReportsHeader;
