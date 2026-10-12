import { PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { CompanyUsersTable } from '../company-users/CompanyUsersTable';

const { Title } = Typography;

interface MembersTabProps {
  clientId: string;
  /** Starts the Add Client wizard on "Add a client user" for this company. */
  onAddUser: () => void;
}

/** This company's users: the same table as the Company Users list, scoped to one company. */
export const MembersTab = ({ clientId, onAddUser }: MembersTabProps) => {
  const { t } = useTranslation('client-portal-client-workspace');

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Title level={5} style={{ margin: 0 }}>
          {t('members.title', { defaultValue: 'Company members' })}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAddUser}>
          {t('members.addUser', { defaultValue: 'Add user' })}
        </Button>
      </Flex>

      <CompanyUsersTable
        clientId={clientId}
        onAdd={onAddUser}
        addLabel={t('members.addUser', { defaultValue: 'Add user' })}
      />
    </Flex>
  );
};
