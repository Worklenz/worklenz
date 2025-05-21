import { Drawer, Select, Typography, Flex, Button, Input, Table } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { clearDrawerRatecard, fetchRateCardById, fetchRateCards, toggleRatecardDrawer, updateRateCard } from '../finance-slice';
import { RatecardType, IJobType } from '@/types/project/ratecard.types';
import { IJobTitlesViewModel } from '@/types/job.types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { DeleteOutlined } from '@ant-design/icons';

interface PaginationType {
  current: number;
  pageSize: number;
  field: string;
  order: string;
  total: number;
  pageSizeOptions: string[];
  size: 'small' | 'default';
}
const RatecardDrawer = ({
  type,
  ratecardId,
  onSaved,
}: {
  type: 'create' | 'update';
  ratecardId: string;
  onSaved?: () => void;
}) => {
  const [ratecardsList, setRatecardsList] = useState<RatecardType[]>([]);
  // initial Job Roles List (dummy data)
  const [roles, setRoles] = useState<IJobType[]>([]);

  const { t } = useTranslation('settings/ratecard-settings');
  // get drawer state from client reducer
  const drawerLoading = useAppSelector(state => state.financeReducer.isFinanceDrawerloading);
  const drawerRatecard = useAppSelector(state => state.financeReducer.drawerRatecard);
  const isDrawerOpen = useAppSelector(
    (state) => state.financeReducer.isRatecardDrawerOpen
  );
  const dispatch = useAppDispatch();

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [selectedJobTitleId, setSelectedJobTitleId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [name, setName] = useState<string>('Untitled Rate Card');
  const [jobTitles, setJobTitles] = useState<IJobTitlesViewModel>({});
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    total: 0,
    pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
    size: 'small',
  });

  const getJobTitles = useMemo(() => {
    return async () => {
      const response = await jobTitlesApiService.getJobTitles(
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        searchQuery
      );
      if (response.done) {
        setJobTitles(response.body);
        setPagination(prev => ({ ...prev, total: response.body.total || 0 }));
      }
    };
  }, [pagination.current, pagination.pageSize, pagination.field, pagination.order, searchQuery]);

  // fetch rate cards data
  useEffect(() => {
    getJobTitles();
  }, []);

  // get currently selected ratecard
  const selectedRatecard = ratecardsList.find(
    (ratecard) => ratecard.id === ratecardId
  );

  useEffect(() => {
    if (type === 'update' && ratecardId) {
      dispatch(fetchRateCardById(ratecardId));
    }
    // ...reset logic for create...
  }, [type, ratecardId, dispatch]);

  useEffect(() => {

    if (type === 'update' && drawerRatecard) {
      setRoles(drawerRatecard.jobRolesList || []);
      setName(drawerRatecard.name || '');
      setCurrency(drawerRatecard.currency || 'LKR');
    }
  }, [drawerRatecard, type]);

  // Add All handler
  const handleAddAllRoles = () => {
    if (!jobTitles.data) return;
    // Filter out job titles already in roles
    const existingIds = new Set(roles.map(r => r.job_title_id));
    const newRoles = jobTitles.data
      .filter(jt => !existingIds.has(jt.id!))
      .map(jt => ({
        jobtitle: jt.name,
        rate_card_id: ratecardId,
        job_title_id: jt.id!,
        rate: 0,
      }));
    setRoles([...roles, ...newRoles]);
  };

  // add new job role handler
  const handleAddRole = () => {
    setIsAddingRole(true);
    setSelectedJobTitleId(undefined);
  };
  const handleDeleteRole = (index: number) => {
    const updatedRoles = [...roles];
    updatedRoles.splice(index, 1);
    setRoles(updatedRoles);
  };
  const handleSelectJobTitle = (jobTitleId: string) => {
    const jobTitle = jobTitles.data?.find(jt => jt.id === jobTitleId);
    if (jobTitle) {
      const newRole = {
        jobtitle: jobTitle.name,
        rate_card_id: ratecardId,
        job_title_id: jobTitleId,
        rate: 0,
      };
      setRoles([...roles, newRole]);
    }
    setIsAddingRole(false);
    setSelectedJobTitleId(undefined);
  };

  const handleSave = async () => {
    if (type === 'update' && ratecardId) {
      try {
        await dispatch(updateRateCard({
          id: ratecardId,
          body: {
            name,
            currency,
            jobRolesList: roles,
          },
        }) as any);
        // Refresh the rate cards list in Redux
        await dispatch(fetchRateCards({
          index: 1,
          size: 10,
          field: 'name',
          order: 'desc',
          search: '',
        }) as any);
        if (onSaved) onSaved();
        dispatch(toggleRatecardDrawer());

      } catch (error) {
        console.error('Failed to update rate card', error);
      } finally {
        setRoles([]);
        setName('Untitled Rate Card');
        setCurrency('LKR');
      }
    }
  };

  // table columns
  const columns = [
    {
      title: t('jobTitleColumn'),
      dataIndex: 'jobtitle',
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
            updatedRoles[index].jobtitle = e.target.value;
            setRoles(updatedRoles);
          }}
        />
      ),
    },
    {
      title: `${t('ratePerHourColumn')} (${currency})`,
      dataIndex: 'rate',
      render: (text: number, record: any, index: number) => (
        <Input
          type="number"
          value={roles[index]?.rate ?? 0}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: 0,
          }}
          onChange={(e) => {
            const updatedRoles = roles.map((role, idx) =>
              idx === index ? { ...role, rate: parseInt(e.target.value, 10) || 0 } : role
            );
            setRoles(updatedRoles);
          }}
        />
      ),
    },
    {
      title: t('actionsColumn') || 'Actions',
      dataIndex: 'actions',
      render: (_: any, __: any, index: number) => (
        <Button
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteRole(index)}
        />
      ),
    },
  ];

  return (
    <Drawer
      loading={drawerLoading}
      title={
        <Flex align="center" justify="space-between">
          <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
            <Input
              value={name}
              placeholder="Enter rate card name"
              style={{
                fontWeight: 500,
                fontSize: 16,
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                padding: 0,
              }}
              onChange={e => {
                setName(e.target.value);
              }}
            />
          </Typography.Text>
          <Flex gap={8} align="center">
            <Typography.Text>{t('currency')}</Typography.Text>
            <Select
              value={currency}
              options={[
                { value: 'LKR', label: 'LKR' },
                { value: 'USD', label: 'USD' },
                { value: 'INR', label: 'INR' },
              ]}
              onChange={(value) => setCurrency(value)}
            />
            {/* Add All Button */}
            <Button onClick={handleAddAllRoles} type="default">
              {t('addAllButton') || 'Add All'}
            </Button>
          </Flex>
        </Flex>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleRatecardDrawer())}
      width={700}
      footer={
        <Flex justify="end" gap={16} style={{ marginTop: 16 }}>
          <Button style={{ marginBottom: 24 }} onClick={handleSave} type="primary">{t('saveButton')}</Button>
        </Flex>
      }
    >
      {/* ratecard Table directly inside the Drawer */}
      <Table
        dataSource={roles}
        columns={columns}
        rowKey={(record) => record.job_title_id}
        pagination={false}
        footer={() => (
          isAddingRole ? (
            <Select
              showSearch
              style={{ minWidth: 200 }}
              placeholder={t('selectJobTitle')}
              optionFilterProp="children"
              value={selectedJobTitleId}
              onChange={handleSelectJobTitle}
              onBlur={() => setIsAddingRole(false)}
              filterOption={(input, option) =>
                (option?.children as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {jobTitles.data?.map((jt) => (
                <Select.Option key={jt.id} value={jt.id}>
                  {jt.name}
                </Select.Option>
              ))}
            </Select>
          ) : (
            <Button
              type="dashed"
              onClick={handleAddRole}
              block
              style={{ margin: 0, padding: 0 }}
            >
              {t('addRoleButton')}
            </Button>
          )
        )}
      />
    </Drawer>
  );
};

export default RatecardDrawer;
