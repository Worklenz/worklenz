import { Card, Table, Typography } from 'antd';
import { TableProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import ClientPortalStatusTags from '@/components/client-portal/client-portal-status-tags';
import { TempRequestsType } from '../../../types/client-portal/temp-client-portal.types';
import { useNavigate } from 'react-router-dom';
import { setSelectedRequestNo } from '../../../features/clients-portal/requests/requests-slice';
import { useAppDispatch } from '../../../hooks/useAppDispatch';

const RequestsTable = () => {
  // localization
  const { t } = useTranslation('client-portal-requests');

  //   get requests list from requests reducer
  const requestsList: TempRequestsType[] = useAppSelector(
    (state) => state.clientsPortalReducer.requestsReducer.requests
  );

  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'reqNo',
      title: t('reqNoColumn'),
      render: (record) => <Typography.Text>{record.req_no}</Typography.Text>,
    },
    {
      key: 'service',
      title: t('serviceColumn'),
      render: (record) => <Typography.Text>{record.service}</Typography.Text>,
    },
    {
      key: 'client',
      title: t('clientColumn'),
      render: (record) => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>
          {record.client}
        </Typography.Text>
      ),
    },
    {
      key: 'status',
      title: t('statusColumn'),
      render: (record) => <ClientPortalStatusTags status={record.status} />,
    },
    {
      key: 'time',
      title: t('timeColumn'),
      render: (record) => (
        <Typography.Text>{durationDateFormat(record.time)}</Typography.Text>
      ),
    },
  ];

  return (
    <Card style={{ height: 'calc(100vh - 280px)' }}>
      <Table
        columns={columns}
        dataSource={requestsList}
        pagination={{
          size: 'small',
        }}
        scroll={{
          x: 'max-content',
        }}
        onRow={(record) => {
          return {
            onClick: () => {
              dispatch(setSelectedRequestNo(record.req_no));
              navigate(`/worklenz/client-portal/requests/${record.id}`);
            },
            style: { cursor: 'pointer' },
          };
        }}
      />
    </Card>
  );
};

export default RequestsTable;
