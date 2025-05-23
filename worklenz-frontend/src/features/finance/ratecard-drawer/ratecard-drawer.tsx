import { Drawer, Select, Typography, Flex, Button, Input, Table } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { deleteRateCard, fetchRateCardById, fetchRateCards, toggleRatecardDrawer, updateRateCard } from '../finance-slice';
import { RatecardType, IJobType } from '@/types/project/ratecard.types';
import { IJobTitlesViewModel } from '@/types/job.types';
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
  const [addingRowIndex, setAddingRowIndex] = useState<number | null>(null);
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
  const [currency, setCurrency] = useState('USD');
  const [name, setName] = useState<string>('Untitled Rate Card');
  const [jobTitles, setJobTitles] = useState<IJobTitlesViewModel>({});
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    pageSize: 10000,
    field: 'name',
    order: 'desc',
    total: 0,
    pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
    size: 'small',
  });
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

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
      setCurrency(drawerRatecard.currency || 'USD');
    }
  }, [drawerRatecard, type]);

  // Add All handler
  const handleAddAllRoles = () => {
    if (!jobTitles.data) return;
    // Get current job_title_ids in roles
    const existingIds = new Set(roles.map(r => r.job_title_id));
    // Only add job titles not already present
    const newRoles = jobTitles.data
      .filter(jt => jt.id && !existingIds.has(jt.id))
      .map(jt => ({
        jobtitle: jt.name,
        rate_card_id: ratecardId,
        job_title_id: jt.id!,
        rate: 0,
      }));
    // Prevent any accidental duplicates by merging and filtering again
    const mergedRoles = [...roles, ...newRoles].filter(
      (role, idx, arr) =>
        arr.findIndex(r => r.job_title_id === role.job_title_id) === idx
    );
    setRoles(mergedRoles);
  };


  const handleAddRole = () => {
    const existingIds = new Set(roles.map(r => r.job_title_id));
    const availableJobTitles = jobTitles.data?.filter(jt => !existingIds.has(jt.id!));
    if (availableJobTitles && availableJobTitles.length > 0) {
      setRoles([...roles, { job_title_id: '', rate: 0 }]);
      setAddingRowIndex(roles.length);
      setIsAddingRole(true);
    }
  };

  const handleDeleteRole = (index: number) => {
    const updatedRoles = [...roles];
    updatedRoles.splice(index, 1);
    setRoles(updatedRoles);
  };
  const handleSelectJobTitle = (jobTitleId: string) => {
    // Prevent duplicate job_title_id
    if (roles.some(role => role.job_title_id === jobTitleId)) {
      setIsAddingRole(false);
      setSelectedJobTitleId(undefined);
      return;
    }
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
        // Filter out roles with no jobtitle or empty jobtitle
        const filteredRoles = roles.filter(role => role.jobtitle && role.jobtitle.trim() !== '');
        await dispatch(updateRateCard({
          id: ratecardId,
          body: {
            name,
            currency,
            jobRolesList: filteredRoles,
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
        setCurrency('USD');
      }
    }
  };

  // table columns
  const columns = [
    {
      title: t('jobTitleColumn'),
      dataIndex: 'jobtitle',
      render: (text: string, record: any, index: number) => {
        if (index === addingRowIndex || index === editingRowIndex) {
          return (
            <Select
              showSearch
              autoFocus
              placeholder={t('selectJobTitle')}
              style={{ minWidth: 150 }}
              value={record.job_title_id || undefined}
              onChange={value => {
                // Prevent duplicate job_title_id
                if (roles.some((role, idx) => role.job_title_id === value && idx !== index)) {
                  return;
                }
                const updatedRoles = [...roles];
                const selectedJob = jobTitles.data?.find(jt => jt.id === value);
                updatedRoles[index].job_title_id = value;
                updatedRoles[index].jobtitle = selectedJob?.name || '';
                setRoles(updatedRoles);
                setEditingRowIndex(null);
                setAddingRowIndex(null);
              }}
              onBlur={() => {
                if (roles[index].job_title_id === ""){
                  handleDeleteRole(index);
                }
                setEditingRowIndex(null);
                setAddingRowIndex(null);
              }}
              filterOption={(input, option) =>
                (option?.children as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {jobTitles.data
                ?.filter(jt => !roles.some((role, idx) => role.job_title_id === jt.id && idx !== index))
                .map(jt => (
                  <Select.Option key={jt.id} value={jt.id}>
                    {jt.name}
                  </Select.Option>
                ))}
            </Select>
          );
        }
        // Render as clickable text for existing rows
        return (
          <span
            style={{ cursor: 'pointer' }}
            // onClick={() => setEditingRowIndex(index)}
          >
            {record.jobtitle}
          </span>
        );
      },
    },
    {
      title: `${t('ratePerHourColumn')} (${currency})`,
      dataIndex: 'rate',
      align: 'right',
      render: (text: number, record: any, index: number) => (
        <Input
          type="number"
          value={roles[index]?.rate ?? 0}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            textAlign: 'right',
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
  const handleDrawerClose = async () => {
    if (
      drawerRatecard &&
      (drawerRatecard.jobRolesList?.length === 0 || !drawerRatecard.jobRolesList) &&
      name === 'Untitled Rate Card'
    ) {
      await dispatch(deleteRateCard(drawerRatecard.id as string));
    }
    dispatch(toggleRatecardDrawer());
  };

  return (
    <Drawer
      loading={drawerLoading}
      onClose={handleDrawerClose}
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
                { value: 'USD', label: 'USD' },
                { value: 'LKR', label: 'LKR' },
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
          <Button
              type="dashed"
              onClick={handleAddRole}
              block
              style={{ margin: 0, padding: 0 }}
            >
              {t('addRoleButton')}
            </Button>
        )}
      />
    </Drawer>
  );
};

export default RatecardDrawer;
