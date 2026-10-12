import { Card, Table, Typography } from '@/shared/antd-imports';
import { TableProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
// import { toggleRequestModal } from '../../../features/clients-portal/requests/requests-slice';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import ClientPortalStatusTags from '../../../components/client-portal/ClientPortalStatusTags';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { TempRequestsType } from '../../../types/client-portal/temp-client-portal.types';

const RequestsTable = () => {
  // localization
  const { t } = useTranslation('client-view/client-view-requests');

  //   get requests list from requests reducer
  const requestsList: TempRequestsType[] = useAppSelector(
    state => state.clientsPortalReducer.requestsReducer.requests
  );

  const dispatch = useAppDispatch();

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'service',
      title: t('table.header.service'),
      render: record => <Typography.Text>{record.service}</Typography.Text>,
    },
    {
      key: 'status',
      title: t('table.header.status'),
      render: record => <ClientPortalStatusTags status={record.status} />,
    },
    {
      key: 'time',
      title: t('table.header.time'),
      render: record => <Typography.Text>{durationDateFormat(record.time)}</Typography.Text>,
    },
    {
      key: 'lastChat',
      title: t('table.header.lastChat'),
      render: record => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>_</Typography.Text>
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
        onRow={record => {
          return {
            onClick: () => {
              // dispatch(toggleRequestModal(record.req_no));
            },
            style: { cursor: 'pointer' },
          };
        }}
      />
    </Card>
  );
};

export default RequestsTable;
