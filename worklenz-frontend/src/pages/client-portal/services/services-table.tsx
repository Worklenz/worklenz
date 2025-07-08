import { Card, Table, Typography } from 'antd';
import { TableProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import ClientPortalStatusTags from '@/components/client-portal/client-portal-status-tags';
import { TempServicesType } from '../../../types/client-portal/temp-client-portal.types';

const ServicesTable = () => {
  // localization
  const { t } = useTranslation('client-portal-services');

  //   get services list from services reducer
  const servicesList: TempServicesType[] = useAppSelector(
    (state) => state.clientsPortalReducer.servicesReducer.services
  );

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('nameColumn'),
      render: (record) => <Typography.Text>{record.name}</Typography.Text>,
    },
    {
      key: 'createdBy',
      title: t('createdByColumn'),
      render: (record) => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>
          {record.created_by}
        </Typography.Text>
      ),
    },
    {
      key: 'status',
      title: t('statusColumn'),
      render: (record) => <ClientPortalStatusTags status={record.status} />,
    },
    {
      key: 'noOfRequests',
      title: t('noOfRequestsColumn'),
      render: (record) => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>
          {record.no_of_requests}
        </Typography.Text>
      ),
    },
  ];

  return (
    <Card style={{ height: 'calc(100vh - 280px)' }}>
      <Table
        columns={columns}
        dataSource={servicesList}
        pagination={{
          size: 'small',
        }}
        scroll={{
          x: 'max-content',
        }}
        onRow={(record) => {
          return {
            style: { cursor: 'pointer' },
          };
        }}
      />
    </Card>
  );
};

export default ServicesTable;
