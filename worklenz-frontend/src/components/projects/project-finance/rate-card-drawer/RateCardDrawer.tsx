import {
  Drawer,
  Select,
  Typography,
  Flex,
  Button,
  Input,
  Table,
  Tooltip,
  Alert,
  Space,
  message,
  Popconfirm,
  DeleteOutlined,
  ExclamationCircleFilled,
  PlusOutlined,
} from '@/shared/antd-imports';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  deleteRateCard,
  fetchRateCardById,
  fetchRateCards,
  toggleRatecardDrawer,
  updateRateCard,
} from '@/features/finance/finance-slice';
import { RatecardType, IJobType } from '@/types/project/ratecard.types';
import { IJobTitlesViewModel } from '@/types/job.types';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { colors } from '@/styles/colors';
import CreateJobTitlesDrawer from '@/features/settings/job/CreateJobTitlesDrawer';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '@/shared/currencies';
import { IOrganization } from '@/types/admin-center/admin-center.types';

interface PaginationType {
  current: number;
  pageSize: number;
  field: string;
  order: string;
  total: number;
  pageSizeOptions: string[];
  size: 'small' | 'default';
}

const RateCardDrawer = ({
  type,
  ratecardId,
  onSaved,
}: {
  type: 'create' | 'update';
  ratecardId: string;
  onSaved?: () => void;
}) => {
  const [ratecardsList, setRatecardsList] = useState<RatecardType[]>([]);
  const [roles, setRoles] = useState<IJobType[]>([]);
  const [initialRoles, setInitialRoles] = useState<IJobType[]>([]);
  const [initialName, setInitialName] = useState<string>('Untitled Rate Card');
  const [initialCurrency, setInitialCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [addingRowIndex, setAddingRowIndex] = useState<number | null>(null);
  const [organization, setOrganization] = useState<IOrganization | null>(null);
  const { t } = useTranslation('settings/ratecard-settings');
  const drawerLoading = useAppSelector(state => state.financeReducer.isFinanceDrawerloading);
  const drawerRatecard = useAppSelector(state => state.financeReducer.drawerRatecard);
  const isDrawerOpen = useAppSelector(state => state.financeReducer.isRatecardDrawerOpen);
  const dispatch = useAppDispatch();

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [selectedJobTitleId, setSelectedJobTitleId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
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
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [isCreatingJobTitle, setIsCreatingJobTitle] = useState(false);
  const [newJobTitleName, setNewJobTitleName] = useState('');

  // Determine if we're using man days calculation method
  const isManDaysMethod = organization?.calculation_method === 'man_days';

  // Detect changes
  const hasChanges = useMemo(() => {
    const rolesChanged = JSON.stringify(roles) !== JSON.stringify(initialRoles);
    const nameChanged = name !== initialName;
    const currencyChanged = currency !== initialCurrency;
    return rolesChanged || nameChanged || currencyChanged;
  }, [roles, name, currency, initialRoles, initialName, initialCurrency]);

  // Fetch organization details
  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const response = await adminCenterApiService.getOrganizationDetails();
        if (response.done) {
          setOrganization(response.body);
        }
      } catch (error) {
        console.error('Failed to fetch organization details:', error);
      }
    };

    if (isDrawerOpen) {
      fetchOrganization();
    }
  }, [isDrawerOpen]);

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

  useEffect(() => {
    getJobTitles();
  }, []);

  const selectedRatecard = ratecardsList.find(ratecard => ratecard.id === ratecardId);

  useEffect(() => {
    if (type === 'update' && ratecardId) {
      dispatch(fetchRateCardById(ratecardId));
    }
  }, [type, ratecardId, dispatch]);

  useEffect(() => {
    if (type === 'update' && drawerRatecard) {
      setRoles(drawerRatecard.jobRolesList || []);
      setInitialRoles(drawerRatecard.jobRolesList || []);
      setName(drawerRatecard.name || '');
      setInitialName(drawerRatecard.name || '');
      setCurrency(drawerRatecard.currency || DEFAULT_CURRENCY);
      setInitialCurrency(drawerRatecard.currency || DEFAULT_CURRENCY);
    }
  }, [drawerRatecard, type]);

  const handleAddAllRoles = () => {
    if (!jobTitles.data) return;
    const existingIds = new Set(roles.map(r => r.job_title_id));
    const newRoles = jobTitles.data
      .filter(jt => jt.id && !existingIds.has(jt.id))
      .map(jt => ({
        jobtitle: jt.name,
        rate_card_id: ratecardId,
        job_title_id: jt.id || '',
        rate: 0,
        man_day_rate: 0,
      }));
    const mergedRoles = [...roles, ...newRoles].filter(
      (role, idx, arr) => arr.findIndex(r => r.job_title_id === role.job_title_id) === idx
    );
    setRoles(mergedRoles);
  };

  const handleAddRole = () => {
    if (Object.keys(jobTitles).length === 0) {
      // Allow inline job title creation
      setIsCreatingJobTitle(true);
    } else {
      // Add a new empty role to the table
      const newRole = {
        jobtitle: '',
        rate_card_id: ratecardId,
        job_title_id: '',
        rate: 0,
        man_day_rate: 0,
      };
      setRoles([...roles, newRole]);
      setAddingRowIndex(roles.length);
      setIsAddingRole(true);
    }
  };

  const handleCreateJobTitle = async () => {
    if (!newJobTitleName.trim()) {
      messageApi.warning(t('jobTitleNameRequired') || 'Job title name is required');
      return;
    }

    try {
      // Create the job title using the API
      const response = await jobTitlesApiService.createJobTitle({
        name: newJobTitleName.trim(),
      });

      if (response.done) {
        // Refresh job titles
        await getJobTitles();

        // Create a new role with the newly created job title
        const newRole = {
          jobtitle: newJobTitleName.trim(),
          rate_card_id: ratecardId,
          job_title_id: response.body.id,
          rate: 0,
          man_day_rate: 0,
        };
        setRoles([...roles, newRole]);

        // Reset creation state
        setIsCreatingJobTitle(false);
        setNewJobTitleName('');

        messageApi.success(t('jobTitleCreatedSuccess') || 'Job title created successfully');
      } else {
        messageApi.error(t('jobTitleCreateError') || 'Failed to create job title');
      }
    } catch (error) {
      console.error('Failed to create job title:', error);
      messageApi.error(t('jobTitleCreateError') || 'Failed to create job title');
    }
  };

  const handleCancelJobTitleCreation = () => {
    setIsCreatingJobTitle(false);
    setNewJobTitleName('');
  };

  const handleDeleteRole = (index: number) => {
    const updatedRoles = [...roles];
    updatedRoles.splice(index, 1);
    setRoles(updatedRoles);
  };

  const handleSelectJobTitle = (jobTitleId: string) => {
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
        man_day_rate: 0,
      };
      setRoles([...roles, newRole]);
    }
    setIsAddingRole(false);
    setSelectedJobTitleId(undefined);
  };

  const handleSave = async () => {
    if (type === 'update' && ratecardId) {
      try {
        const filteredRoles = roles.filter(role => role.jobtitle && role.jobtitle.trim() !== '');
        await dispatch(
          updateRateCard({
            id: ratecardId,
            body: {
              name,
              currency,
              jobRolesList: filteredRoles,
            },
          }) as any
        );
        await dispatch(
          fetchRateCards({
            index: 1,
            size: 10,
            field: 'name',
            order: 'desc',
            search: '',
          }) as any
        );
        if (onSaved) onSaved();
        dispatch(toggleRatecardDrawer());
        // Reset initial states after save
        setInitialRoles(filteredRoles);
        setInitialName(name);
        setInitialCurrency(currency);
        setShowUnsavedAlert(false);
      } catch (error) {
        console.error('Failed to update rate card', error);
      }
    }
  };

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
                if (roles[index].job_title_id === '') {
                  handleDeleteRole(index);
                }
                setEditingRowIndex(null);
                setAddingRowIndex(null);
              }}
              filterOption={(input, option) =>
                String(option?.children || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {jobTitles.data
                ?.filter(
                  jt => !roles.some((role, idx) => role.job_title_id === jt.id && idx !== index)
                )
                .map(jt => (
                  <Select.Option key={jt.id} value={jt.id}>
                    {jt.name}
                  </Select.Option>
                ))}
            </Select>
          );
        }
        return <span style={{ cursor: 'pointer' }}>{record.jobtitle}</span>;
      },
    },
    {
      title: isManDaysMethod
        ? `${t('ratePerManDayColumn', { ns: 'project-view-finance' }) || 'Rate per day'} (${currency})`
        : `${t('ratePerHourColumn')} (${currency})`,
      dataIndex: isManDaysMethod ? 'man_day_rate' : 'rate',
      align: 'right' as const,
      render: (text: number, record: any, index: number) => (
        <Input
          type="number"
          value={isManDaysMethod ? (roles[index]?.man_day_rate ?? 0) : (roles[index]?.rate ?? 0)}
          min={0}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            textAlign: 'right',
            padding: 0,
          }}
          onChange={e => {
            const newValue = parseInt(e.target.value, 10) || 0;
            const updatedRoles = roles.map((role, idx) =>
              idx === index
                ? {
                    ...role,
                    ...(isManDaysMethod ? { man_day_rate: newValue } : { rate: newValue }),
                  }
                : role
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
        <Popconfirm
          title={t('deleteConfirmationTitle')}
          icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
          okText={t('deleteConfirmationOk')}
          cancelText={t('deleteConfirmationCancel')}
          onConfirm={async () => {
            handleDeleteRole(index);
          }}
        >
          <Tooltip title={t('deleteTooltip') || 'Delete'}>
            <Button size="small" icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  const handleDrawerClose = async () => {
    if (!name || name.trim() === '') {
      messageApi.open({
        type: 'warning',
        content: t('ratecardNameRequired') || 'Rate card name is required.',
      });
      return;
    } else if (hasChanges) {
      setShowUnsavedAlert(true);
    } else if (name === 'Untitled Rate Card' && roles.length === 0) {
      await dispatch(deleteRateCard(ratecardId));
      dispatch(toggleRatecardDrawer());
    } else {
      dispatch(toggleRatecardDrawer());
    }
  };

  const handleConfirmSave = async () => {
    await handleSave();
    setShowUnsavedAlert(false);
  };

  const handleConfirmDiscard = () => {
    dispatch(toggleRatecardDrawer());
    setRoles([]);
    setName('Untitled Rate Card');
    setCurrency(DEFAULT_CURRENCY);
    setInitialRoles([]);
    setInitialName('Untitled Rate Card');
    setInitialCurrency(DEFAULT_CURRENCY);
    setShowUnsavedAlert(false);
  };

  return (
    <>
      {contextHolder}
      <Drawer
        loading={drawerLoading}
        onClose={handleDrawerClose}
        title={
          <Flex align="center" justify="space-between">
            <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
              <Input
                value={name}
                placeholder={t('ratecardNamePlaceholder')}
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
                options={CURRENCY_OPTIONS}
                onChange={value => setCurrency(value)}
              />
              <Button onClick={handleAddAllRoles} type="default">
                {t('addAllButton')}
              </Button>
            </Flex>
          </Flex>
        }
        open={isDrawerOpen}
        width={700}
        footer={
          <Flex justify="end" gap={16} style={{ marginTop: 16 }}>
            <Button
              style={{ marginBottom: 24 }}
              onClick={handleSave}
              type="primary"
              disabled={name === '' || (name === 'Untitled Rate Card' && roles.length === 0)}
            >
              {t('saveButton')}
            </Button>
          </Flex>
        }
      >
        {showUnsavedAlert && (
          <Alert
            message={t('unsavedChangesTitle') || 'Unsaved Changes'}
            type="warning"
            showIcon
            closable
            onClose={() => setShowUnsavedAlert(false)}
            action={
              <Space direction="horizontal">
                <Button size="small" type="primary" onClick={handleConfirmSave}>
                  {t('saveButton') || 'Save'}
                </Button>
                <Button size="small" danger onClick={handleConfirmDiscard}>
                  {t('discardButton') || 'Discard'}
                </Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <Flex vertical gap={16}>
          <Flex justify="space-between" align="center">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t('jobRolesTitle') || 'Job Roles'}
            </Typography.Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRole}>
              {t('addRoleButton')}
            </Button>
          </Flex>

          <Table
            dataSource={roles}
            columns={columns}
            rowKey="job_title_id"
            pagination={false}
            locale={{
              emptyText: isCreatingJobTitle ? (
                <Flex vertical align="center" gap={16} style={{ padding: '24px 0' }}>
                  <Typography.Text strong>
                    {t('createNewJobTitle') || 'Create New Job Title'}
                  </Typography.Text>
                  <Flex gap={8} align="center">
                    <Input
                      placeholder={t('jobTitleNamePlaceholder') || 'Enter job title name'}
                      value={newJobTitleName}
                      onChange={e => setNewJobTitleName(e.target.value)}
                      onPressEnter={handleCreateJobTitle}
                      autoFocus
                      style={{ width: 200 }}
                    />
                    <Button type="primary" onClick={handleCreateJobTitle}>
                      {t('createButton') || 'Create'}
                    </Button>
                    <Button onClick={handleCancelJobTitleCreation}>
                      {t('cancelButton') || 'Cancel'}
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                <Flex vertical align="center" gap={16} style={{ padding: '24px 0' }}>
                  <Typography.Text type="secondary">
                    {Object.keys(jobTitles).length === 0
                      ? t('noJobTitlesAvailable')
                      : t('noRolesAdded')}
                  </Typography.Text>
                </Flex>
              ),
            }}
          />

          {organization && (
            <Alert
              message={
                isManDaysMethod
                  ? t('manDaysCalculationMessage', { 
                      hours: organization.hours_per_day || 8 
                    }) || `Organization is using man days calculation (${organization.hours_per_day || 8}h/day). Rates above represent daily rates.`
                  : t('hourlyCalculationMessage') || 'Organization is using hourly calculation. Rates above represent hourly rates.'
              }
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Flex>
      </Drawer>
      <CreateJobTitlesDrawer />
    </>
  );
};

export default RateCardDrawer;
