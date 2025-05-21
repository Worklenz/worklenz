import { Avatar, Button, Input, Popconfirm, Table, TableProps } from 'antd';
import React, { useEffect } from 'react';
import CustomAvatar from '../../../../../../components/CustomAvatar';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { JobRoleType } from '@/types/project/ratecard.types';
import { deleteProjectRateCardRoleById, fetchProjectRateCardRoles } from '@/features/finance/project-finance-slice';
import { useParams } from 'react-router-dom';

const RatecardTable: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view-finance');
  const { projectId } = useParams();

  // Fetch roles from Redux
  const roles = useAppSelector((state) => state.projectFinanceRateCard.rateCardRoles) || [];
  const isLoading = useAppSelector((state) => state.projectFinanceRateCard.isLoading);

  // get currently using currency from finance reducer
  const currency = useAppSelector(
    (state) => state.financeReducer.currency
  ).toUpperCase();

  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjectRateCardRoles(projectId));
    }
  }, [dispatch, projectId]);

  const handleAddRole = () => {
    // You can implement add role logic here if needed
  };

  const columns: TableProps<JobRoleType>['columns'] = [
    {
      title: t('jobTitleColumn'),
      dataIndex: 'jobtitle',
      render: (text: string) => (
        <span style={{ color: '#1890ff' }}>{text}</span>
      ),
    },
    {
      title: `${t('ratePerHourColumn')} (${currency})`,
      dataIndex: 'rate',
      render: (text: number) => <span>{text}</span>,
    },
    {
      title: t('membersColumn'),
      dataIndex: 'members',
      render: (members: string[]) =>
        members?.length > 0 ? (
          <Avatar.Group>
            {members.map((member, i) => (
              <CustomAvatar key={i} avatarName={member} size={26} />
            ))}
          </Avatar.Group>
        ) : (
          <Button
            shape="circle"
            icon={
              <PlusOutlined
                style={{
                  fontSize: 12,
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            }
          />
        ),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: JobRoleType) => (
        <Popconfirm
          title={t('deleteConfirm')}
          onConfirm={() => {
            if (record.id) {
              dispatch(deleteProjectRateCardRoleById(record.id));
            }
          }}
          okText={t('yes')}
          cancelText={t('no')}
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Table
      dataSource={roles}
      columns={columns}
      rowKey={(record) => record.id || record.job_title_id}
      pagination={false}
      loading={isLoading}
      footer={() => (
        <Button
          type="dashed"
          onClick={handleAddRole}
          style={{ width: 'fit-content' }}
        >
          {t('addRoleButton')}
        </Button>
      )}
    />
  );
};

export default RatecardTable;