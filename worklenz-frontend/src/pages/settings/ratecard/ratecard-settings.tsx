import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../../hooks/useDoumentTItle';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import { toggleRatecardDrawer } from '../../../features/finance/finance-slice';
import RatecardDrawer from '../../../features/finance/ratecard-drawer/ratecard-drawer';
import { fetchData } from '../../../utils/fetchData';
import { RatecardType } from '@/types/project/ratecard.types';

const RatecardSettings = () => {
  const [ratecardsList, setRatecardsList] = useState<RatecardType[]>([]);
  // get currently selected ratecard id
  const [selectedRatecardId, setSelectedRatecardId] = useState<string | null>(
    null
  );
  const [ratecardDrawerType, setRatecardDrawerType] = useState<
    'create' | 'update'
  >('create');

  // localization
  const { t } = useTranslation('/settings/ratecard-settings');

  useDocumentTitle('Manage Rate Cards');

  // Fetch rate cards data
  useEffect(() => {
    fetchData('/finance-mock-data/ratecards-data.json', setRatecardsList);
  }, []);

  const dispatch = useAppDispatch();

  // this is for get the current string that type on search bar
  const [searchQuery, setSearchQuery] = useState<string>('');

  // used useMemo hook for re render the list when searching
  const filteredRatecardsData = useMemo(() => {
    return ratecardsList.filter((item) =>
      item.ratecardName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ratecardsList, searchQuery]);

  // function to create ratecard
  const onRatecardCreate = () => {
    setRatecardDrawerType('create');
    dispatch(toggleRatecardDrawer());
  };

  // function to update a ratecard
  const onRatecardUpdate = (id: string) => {
    setRatecardDrawerType('update');
    setSelectedRatecardId(id);
    dispatch(toggleRatecardDrawer());
  };

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'rateName',
      title: t('nameColumn'),
      onCell: (record) => ({
        onClick: () => {
          setSelectedRatecardId(record.ratecardId);
          //   dispatch(toggleUpdateRateDrawer());
        },
      }),
      render: (record) => (
        <Typography.Text className="group-hover:text-[#1890ff]">
          {record.ratecardName}
        </Typography.Text>
      ),
    },
    {
      key: 'created',
      title: t('createdColumn'),
      onCell: (record) => ({
        onClick: () => {
          setSelectedRatecardId(record.ratecardId);
          //   dispatch(toggleUpdateRateDrawer());
        },
      }),
      render: (record) => (
        <Typography.Text>
          {durationDateFormat(record.createdDate)}
        </Typography.Text>
      ),
    },
    {
      key: 'actionBtns',
      width: 80,
      render: (record) => (
        <Flex
          gap={8}
          style={{ padding: 0 }}
          className="hidden group-hover:block"
        >
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                onRatecardUpdate(record.ratecardId);
              }}
            />
          </Tooltip>

          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={
              <ExclamationCircleFilled
                style={{ color: colors.vibrantOrange }}
              />
            }
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            // onConfirm={() => dispatch(deleteRatecard(record.ratecardId))}
          >
            <Tooltip title="Delete">
              <Button
                shape="default"
                icon={<DeleteOutlined />}
                size="small"
                style={{ marginInlineStart: 8 }}
              />
            </Tooltip>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="flex-end">
          <Flex
            gap={8}
            align="center"
            justify="flex-end"
            style={{ width: '100%', maxWidth: 400 }}
          >
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder={t('searchPlaceholder')}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />
            <Button type="primary" onClick={onRatecardCreate}>
              {t('createRatecard')}
            </Button>
          </Flex>
        </Flex>
      }
    >
      <Table
        className="custom-two-colors-row-table"
        dataSource={filteredRatecardsData}
        columns={columns}
        rowKey={(record) => record.rateId}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: 20,
          pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
          size: 'small',
        }}
        onRow={(record) => {
          return {
            className: 'group',
            style: {
              cursor: 'pointer',
              height: 36,
            },
          };
        }}
      />

      {/*  rate drawers  */}
      <RatecardDrawer
        type={ratecardDrawerType}
        ratecardId={selectedRatecardId || ''}
      />
    </Card>
  );
};

export default RatecardSettings;
