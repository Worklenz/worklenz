import { Drawer, Select, Typography, Flex, Button, Input, Table } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { fetchData } from '../../../utils/fetchData';
import { toggleRatecardDrawer } from '../finance-slice';
import { RatecardType } from '@/types/project/ratecard.types';
import { JobType } from '@/types/project/job.types';

const RatecardDrawer = ({
  type,
  ratecardId,
}: {
  type: 'create' | 'update';
  ratecardId: string;
}) => {
  const [ratecardsList, setRatecardsList] = useState<RatecardType[]>([]);
  // initial Job Roles List (dummy data)
  const [roles, setRoles] = useState<JobType[]>([]);

  // localization
  const { t } = useTranslation('ratecard-settings');

  // get drawer state from client reducer
  const isDrawerOpen = useAppSelector(
    (state) => state.financeReducer.isRatecardDrawerOpen
  );
  const dispatch = useAppDispatch();

  // fetch rate cards data
  useEffect(() => {
    fetchData('/finance-mock-data/ratecards-data.json', setRatecardsList);
  }, []);

  // get currently selected ratecard
  const selectedRatecard = ratecardsList.find(
    (ratecard) => ratecard.ratecardId === ratecardId
  );

  useEffect(() => {
    type === 'update'
      ? setRoles(selectedRatecard?.jobRolesList || [])
      : setRoles([
          {
            jobId: 'J001',
            jobTitle: 'Project Manager',
            ratePerHour: 50,
          },
          {
            jobId: 'J002',
            jobTitle: 'Senior Software Engineer',
            ratePerHour: 40,
          },
          {
            jobId: 'J003',
            jobTitle: 'Junior Software Engineer',
            ratePerHour: 25,
          },
          {
            jobId: 'J004',
            jobTitle: 'UI/UX Designer',
            ratePerHour: 30,
          },
        ]);
  }, [selectedRatecard?.jobRolesList, type]);

  // get currently using currency from finance reducer
  const currency = useAppSelector(
    (state) => state.financeReducer.currency
  ).toUpperCase();

  // add new job role handler
  const handleAddRole = () => {
    const newRole = {
      jobId: `J00${roles.length + 1}`,
      jobTitle: 'New Role',
      ratePerHour: 0,
    };
    setRoles([...roles, newRole]);
  };

  // table columns
  const columns = [
    {
      title: t('jobTitleColumn'),
      dataIndex: 'jobTitle',
      render: (text: string, record: any, index: number) => (
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
      render: (text: number, record: any, index: number) => (
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
  ];

  return (
    <Drawer
      title={
        <Flex align="center" justify="space-between">
          <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
            {type === 'update'
              ? selectedRatecard?.ratecardName
              : 'Untitled Rate Card'}
          </Typography.Text>

          <Flex gap={8} align="center">
            <Typography.Text>{t('currency')}</Typography.Text>
            <Select
              defaultValue={'lkr'}
              options={[
                { value: 'lkr', label: 'LKR' },
                { value: 'usd', label: 'USD' },
                { value: 'inr', label: 'INR' },
              ]}
            />
          </Flex>
        </Flex>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleRatecardDrawer())}
      width={800}
    >
      {/* ratecard Table directly inside the Drawer */}
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

      <Flex justify="end" gap={16} style={{ marginTop: 16 }}>
        <Button type="primary">{t('saveButton')}</Button>
      </Flex>
    </Drawer>
  );
};

export default RatecardDrawer;
