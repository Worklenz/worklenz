import { Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import RequestsTable from './requests-table';

const { Title } = Typography;

const ClientPortalRequests = () => {
  // localization
  const { t } = useTranslation('client-portal-requests');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        maxWidth: '100%',
      }}
    >
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('title', { defaultValue: 'Requests' })}
        </Title>
        <Typography.Text type="secondary">
          {t('description', {
            defaultValue: 'Client requests based on your service offerings and custom requests',
          })}
        </Typography.Text>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <RequestsTable />
      </div>

      {/* requests/:id renders here as a modal over this list, so a direct or shared link
          still shows the list underneath it instead of a blank page. */}
      <Outlet />
    </div>
  );
};

export default ClientPortalRequests;
