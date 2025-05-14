import { Avatar, Button, Input, Table, TableProps } from 'antd';
import React, { useState } from 'react';
import CustomAvatar from '../../../../../../components/CustomAvatar';
import { PlusOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../../../../../hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { JobRoleType } from '@/types/project/ratecard.types';

const initialJobRolesList: JobRoleType[] = [
  {
    jobId: 'J001',
    jobTitle: 'Project Manager',
    ratePerHour: 50,
    members: ['Alice Johnson', 'Bob Smith'],
  },
  {
    jobId: 'J002',
    jobTitle: 'Senior Software Engineer',
    ratePerHour: 40,
    members: ['Charlie Brown', 'Diana Prince'],
  },
  {
    jobId: 'J003',
    jobTitle: 'Junior Software Engineer',
    ratePerHour: 25,
    members: ['Eve Davis', 'Frank Castle'],
  },
  {
    jobId: 'J004',
    jobTitle: 'UI/UX Designer',
    ratePerHour: 30,
    members: null,
  },
];

const RatecardTable: React.FC = () => {
  const [roles, setRoles] = useState<JobRoleType[]>(initialJobRolesList);

  // localization
  const { t } = useTranslation('project-view-finance');

  // get currently using currency from finance reducer
  const currency = useAppSelector(
    (state) => state.financeReducer.currency
  ).toUpperCase();

  const handleAddRole = () => {
    const newRole: JobRoleType = {
      jobId: `J00${roles.length + 1}`,
      jobTitle: 'New Role',
      ratePerHour: 0,
      members: [],
    };
    setRoles([...roles, newRole]);
  };

  const columns: TableProps<JobRoleType>['columns'] = [
    {
      title: t('jobTitleColumn'),
      dataIndex: 'jobTitle',
      render: (text: string, record: JobRoleType, index: number) => (
        <Input
          value={text}
          placeholder="Enter job title"
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: 0,
            color: '#1890ff',
          }}
          onChange={(e) => {
            const updatedRoles = [...roles];
            updatedRoles[index].jobTitle = e.target.value;
            setRoles(updatedRoles);
          }}
        />
      ),
    },
    {
      title: `${t('ratePerHourColumn')} (${currency})`,
      dataIndex: 'ratePerHour',
      render: (text: number, record: JobRoleType, index: number) => (
        <Input
          type="number"
          value={text}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: 0,
          }}
          onChange={(e) => {
            const updatedRoles = [...roles];
            updatedRoles[index].ratePerHour = parseInt(e.target.value, 10) || 0;
            setRoles(updatedRoles);
          }}
        />
      ),
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
  ];

  return (
    <Table
      dataSource={roles}
      columns={columns}
      rowKey={(record) => record.jobId}
      pagination={false}
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
