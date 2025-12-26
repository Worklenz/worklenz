import { IOrganization } from '@/types/admin-center/admin-center.types';
import { MailOutlined } from '@/shared/antd-imports';
import { Tooltip, Typography } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

interface OrganizationOwnerProps {
  themeMode: string;
  organization: IOrganization | null;
  t: TFunction;
  refetch: () => void;
}

const OrganizationOwner = ({ themeMode, organization, t }: OrganizationOwnerProps) => {
  return (
    <div style={{ width: '100%' }}>
      <Typography.Title level={5} style={{ margin: 0, marginBottom: 16 }}>
        {t('owner')}
      </Typography.Title>
      <div style={{ paddingTop: '4px' }}>
        <div style={{ marginBottom: '8px' }}>
          <Typography.Text
            style={{
              color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
            }}
          >
            {organization?.owner_name || ''}
          </Typography.Text>
        </div>
      </div>
      <Typography.Paragraph style={{ display: 'flex', alignItems: 'center', margin: '12px 0 0 0' }}>
        <Typography.Text
          style={{
            color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
            fontSize: 14,
          }}
        >
          <span style={{ marginRight: '8px', color: themeMode === 'dark' ? '#8c8c8c' : '#8c8c8c' }}>
            <Tooltip title="Email Address">
              <MailOutlined />
            </Tooltip>
          </span>
          {organization?.email || ''}
        </Typography.Text>
      </Typography.Paragraph>
    </div>
  );
};

export default OrganizationOwner;
