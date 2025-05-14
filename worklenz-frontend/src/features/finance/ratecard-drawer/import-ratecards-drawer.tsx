import { Drawer, Typography, Button, Table, Menu, Flex } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { fetchData } from '../../../utils/fetchData';
import { toggleImportRatecardsDrawer } from '../finance-slice';
import { RatecardType } from '@/types/project/ratecard.types';
const ImportRatecardsDrawer: React.FC = () => {
  const [ratecardsList, setRatecardsList] = useState<RatecardType[]>([]);
  const [selectedRatecardId, setSelectedRatecardId] = useState<string | null>(
    null
  );

  // localization
  const { t } = useTranslation('project-view-finance');

  // get drawer state from client reducer
  const isDrawerOpen = useAppSelector(
    (state) => state.financeReducer.isImportRatecardsDrawerOpen
  );
  const dispatch = useAppDispatch();

  // fetch rate cards data
  useEffect(() => {
    fetchData('/finance-mock-data/ratecards-data.json', setRatecardsList);
  }, []);

  // get currently using currency from finance reducer
  const currency = useAppSelector(
    (state) => state.financeReducer.currency
  ).toUpperCase();

  // find the selected rate card's job roles
  const selectedRatecard =
    ratecardsList.find(
      (ratecard) => ratecard.ratecardId === selectedRatecardId
    ) || null;

  // table columns
  const columns = [
    {
      title: t('jobTitleColumn'),
      dataIndex: 'jobTitle',
      render: (text: string) => (
        <Typography.Text className="group-hover:text-[#1890ff]">
          {text}
        </Typography.Text>
      ),
    },
    {
      title: `${t('ratePerHourColumn')} (${currency})`,
      dataIndex: 'ratePerHour',
      render: (text: number) => <Typography.Text>{text}</Typography.Text>,
    },
  ];

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {t('ratecardsPluralText')}
        </Typography.Text>
      }
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button type="primary">Import</Button>
        </div>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleImportRatecardsDrawer())}
      width={1000}
    >
      <Flex gap={12}>
        {/* sidebar menu */}
        <Menu
          mode="vertical"
          style={{ width: '20%' }}
          selectedKeys={
            selectedRatecardId
              ? [selectedRatecardId]
              : [ratecardsList[0]?.ratecardId]
          }
          onClick={({ key }) => setSelectedRatecardId(key)}
        >
          {ratecardsList.map((ratecard) => (
            <Menu.Item key={ratecard.ratecardId}>
              {ratecard.ratecardName}
            </Menu.Item>
          ))}
        </Menu>

        {/* table for job roles */}
        <Table
          style={{ flex: 1 }}
          dataSource={selectedRatecard?.jobRolesList || []}
          columns={columns}
          rowKey={(record) => record.jobId}
          onRow={() => {
            return {
              className: 'group',
              style: {
                cursor: 'pointer',
              },
            };
          }}
          pagination={false}
        />
      </Flex>
    </Drawer>
  );
};

export default ImportRatecardsDrawer;
