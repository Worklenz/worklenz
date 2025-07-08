import { Button, Flex, Typography } from 'antd';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import AddClientDrawer from '../../../features/clients-portal/clients/add-client-drawer';
import { toggleAddClientDrawer } from '../../../features/clients-portal/clients/clients-slice';
import { useTranslation } from 'react-i18next';
import ClientTemasDrawer from '../../../features/clients-portal/clients/client-teams-drawer';
import ClientPortalClientsSettingsDrawer from '../../../features/clients-portal/clients/client-portal-clients-settings-drawer';
import ClientsTable from './clients-table';

const ClientPortalClients = () => {
  // localization
  const { t } = useTranslation('client-portal-clients');

  const dispatch = useAppDispatch();

  // function to handle add clients
  const handleAddClient = () => {
    dispatch(toggleAddClientDrawer());
  };

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={5}>{t('title')}</Typography.Title>

        <Button type="primary" onClick={handleAddClient}>
          Add Client
        </Button>
      </Flex>

      <ClientsTable />

      {/* drawers  */}
      {/* add clients drawer  */}
      <AddClientDrawer />
      {/* client settings drawer  */}
      <ClientPortalClientsSettingsDrawer />
      {/* client team invite drawer  */}
      <ClientTemasDrawer />
    </Flex>
  );
};

export default ClientPortalClients;
