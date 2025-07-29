import { Table, TableProps, Typography } from '@/shared/antd-imports';
import React, { useMemo } from 'react';
import { IOrganizationAdmin } from '@/types/admin-center/admin-center.types';

interface OrganizationAdminsTableProps {
  organizationAdmins: IOrganizationAdmin[] | null;
  loading: boolean;
  themeMode: string;
}

const { Text } = Typography;

const OrganizationAdminsTable: React.FC<OrganizationAdminsTableProps> = ({
  organizationAdmins,
  loading,
  themeMode,
}) => {
  const columns = useMemo<TableProps<IOrganizationAdmin>['columns']>(
    () => [
      {
        title: <Text strong>Name</Text>,
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <div>
            <Text>
              {text}
              {record.is_owner && <Text> (Owner)</Text>}
            </Text>
          </div>
        ),
      },
      {
        title: <Text strong>Email</Text>,
        dataIndex: 'email',
        key: 'email',
        render: text => <Text>{text}</Text>,
      },
    ],
    []
  );

  return (
    <Table<IOrganizationAdmin>
      className="organization-admins-table"
      columns={columns}
      dataSource={organizationAdmins || []}
      loading={loading}
      showHeader={false}
      pagination={{
        size: 'small',
        pageSize: 10,
        hideOnSinglePage: true,
      }}
      rowKey="email"
    />
  );
};

export default OrganizationAdminsTable;
