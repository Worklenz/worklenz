import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  theme,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Checkbox,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Tooltip,
  Popconfirm,
  message,
  Flex,
  Spin,
  Empty,
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  TableColumnsType,
} from '@/shared/antd-imports';
import {
  useListSchemesQuery,
  useCreateSchemeMutation,
  useDeleteSchemeMutation,
  useUpdateGrantsMutation,
  useAddSchemePermissionsMutation,
  useRemoveSchemePermissionsMutation,
  useGetSchemeQuery,
  useGetTeamProjectSchemesQuery,
  useAssignProjectSchemeMutation,
} from '@/api/admin-center/permission-schemes.api.service';
import {
  IPermissionScheme,
  IPermissionGrant,
  ITeamProjectScheme,
  ORGANIZATION_PERMISSIONS,
} from '@/types/admin-center/permission-schemes.types';

const { Title, Text } = Typography;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_PERMISSION_KEYS = [
  'View project',
  'Create tasks',
  'Edit tasks',
  'Delete tasks',
  'Comment',
  'Manage members',
  'Manage scheme',
  'Manage project settings',
  'Manage statuses',
  'Manage phases',
  'Manage custom columns',
  'View project finance',
  'Save as template',
  'Archive project',
  'Delete project',
] as const;

// Organization-wide permissions only apply to the default scheme
const ORGANIZATION_PERMISSION_KEYS = Object.values(ORGANIZATION_PERMISSIONS);

const PERMISSION_I18N: Record<string, string> = {
  'Manage organization settings': 'permManageOrgSettings',
  'Manage billing':               'permManageBilling',
  'Manage users':                 'permManageUsers',
  'Manage teams':                 'permManageTeams',
  'Create projects':              'permCreateProjects',
  'View all projects':            'permViewAllProjects',
  'View reports':                 'permViewReports',
  'View planner':                 'permViewPlanner',
  'View clients':                 'permViewClients',
  'View finance':                 'permViewFinance',
  'Manage clients':               'permManageClients',
  'View project':   'permViewProject',
  'Create tasks':   'permCreateTasks',
  'Edit tasks':     'permEditTasks',
  'Delete tasks':   'permDeleteTasks',
  'Comment':        'permComment',
  'Manage members': 'permManageMembers',
  'Manage scheme':  'permManageScheme',
  'Manage project settings': 'permManageProjectSettings',
  'Manage statuses':         'permManageStatuses',
  'Manage phases':           'permManagePhases',
  'Manage custom columns':   'permManageCustomColumns',
  'View project finance':    'permViewProjectFinance',
  'Save as template':        'permSaveAsTemplate',
  'Archive project':         'permArchiveProject',
  'Delete project':          'permDeleteProject',
};

// Key = `${role_name}|||${permission}`
const grantKey = (role: string, perm: string) => `${role}|||${perm}`;

const toGrantsState = (grants: IPermissionGrant[]): Record<string, boolean> =>
  Object.fromEntries(grants.map(g => [grantKey(g.role_name, g.permission), g.granted]));
// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const RolesAndPermissionsPage: React.FC = () => {
  const { t } = useTranslation('admin-center/roles-permissions');
  const { token } = theme.useToken();

  const { data: schemes = [], isLoading: schemesLoading } = useListSchemesQuery();

  const sectionStyle: React.CSSProperties = {
    marginBottom: token.marginLG,
    borderRadius: token.borderRadius,
  };

  return (
    <div style={{ padding: token.paddingLG }}>
      {/* Page header */}
      <div style={{ marginBottom: token.marginLG }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('pageTitle', { defaultValue: 'Roles & Permissions' })}
        </Title>
        <Text type="secondary">
          {t('pageDesc', { defaultValue: 'Manage permission schemes and project access' })}
        </Text>
      </div>

      {/* Stat cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: token.marginLG }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{ background: token.colorBgContainer, borderColor: token.colorBorder }}
            styles={{ body: { padding: token.paddingMD } }}
          >
            <Statistic
              title={t('statSchemesLabel', { defaultValue: 'Permission Schemes' })}
              value={schemesLoading ? '—' : schemes.length}
              prefix={<LockOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Step 1 — Permission Schemes */}
      <Card
        title={<Title level={5} style={{ margin: 0 }}>{t('step1Title', { defaultValue: 'Permission Schemes' })}</Title>}
        style={{ ...sectionStyle, borderColor: token.colorBorder }}
        styles={{ body: { padding: token.paddingMD } }}
      >
        <SchemesSection schemes={schemes} loading={schemesLoading} />
      </Card>

      {/* Step 2 — Apply to Projects */}
      <Card
        title={<Title level={5} style={{ margin: 0 }}>{t('step2Title', { defaultValue: 'Apply to Projects' })}</Title>}
        style={{ ...sectionStyle, borderColor: token.colorBorder }}
        styles={{ body: { padding: token.paddingMD } }}
      >
        <ProjectsSection schemes={schemes} />
      </Card>
    </div>
  );
};

export default RolesAndPermissionsPage;

// ---------------------------------------------------------------------------
// Step 1 — SchemesSection
// ---------------------------------------------------------------------------

interface SchemesSectionProps {
  schemes: IPermissionScheme[];
  loading: boolean;
}

const SchemesSection: React.FC<SchemesSectionProps> = ({ schemes, loading }) => {
  const { t } = useTranslation('admin-center/roles-permissions');
  const { token } = theme.useToken();

  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  const [createScheme, { isLoading: isCreating }] = useCreateSchemeMutation();
  const [deleteScheme] = useDeleteSchemeMutation();
  const [updateGrants] = useUpdateGrantsMutation();
  const [addSchemePermissions, { isLoading: isAddingPermissions }] = useAddSchemePermissionsMutation();
  const [removeSchemePermissions] = useRemoveSchemePermissionsMutation();

  const [addPermissionsModalOpen, setAddPermissionsModalOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Pick first scheme by default once loaded
  const activeId = activeSchemeId ?? schemes[0]?.id ?? null;
  const activeScheme = schemes.find(s => s.id === activeId);

  // Fetch full scheme detail (roles + grants) whenever the active scheme changes
  const { data: schemeDetail, isLoading: schemeDetailLoading } = useGetSchemeQuery(activeId ?? '', { skip: !activeId });

  // Local grants state — seeded from server on scheme change, then updated optimistically
  const [grantsState, setGrantsState] = useState<Record<string, boolean>>({});
  // Track which scheme id the grantsState was seeded for (avoid stale re-seeds)
  const seededSchemeIdRef = React.useRef<string | null>(null);

  // Seed grantsState from server whenever the loaded scheme detail changes
  useEffect(() => {
    if (!schemeDetail?.grants || !schemeDetail.scheme?.id) return;
    // Only re-seed when we've switched to a different scheme
    if (seededSchemeIdRef.current === schemeDetail.scheme.id) return;
    seededSchemeIdRef.current = schemeDetail.scheme.id;
    setGrantsState(toGrantsState(schemeDetail.grants));
  }, [schemeDetail]);

  const handleCloseAddPermissions = () => {
    setAddPermissionsModalOpen(false);
    setSelectedPermissions([]);
  };

  const handleAddPermissions = async () => {
    if (!activeScheme || selectedPermissions.length === 0) return;
    try {
      const grants = await addSchemePermissions({
        id: activeScheme.id,
        permissions: selectedPermissions,
      }).unwrap();
      setGrantsState(toGrantsState(grants ?? []));
      void message.success(t('addPermissionsSuccess', { defaultValue: 'Permissions added' }));
      handleCloseAddPermissions();
    } catch {
      void message.error(t('saveError', { defaultValue: 'Could not save changes' }));
    }
  };

  const handleRemovePermission = async (permission: string) => {
    if (!activeScheme) return;
    try {
      const grants = await removeSchemePermissions({
        id: activeScheme.id,
        permissions: [permission],
      }).unwrap();
      setGrantsState(toGrantsState(grants ?? []));
    } catch {
      void message.error(t('saveError', { defaultValue: 'Could not save changes' }));
    }
  };

  const handleGrantChange = useCallback(
    async (
      scheme: IPermissionScheme,
      roleName: string,
      permission: string,
      checked: boolean
    ) => {
      const key = grantKey(roleName, permission);
      setGrantsState(prev => ({ ...prev, [key]: checked }));
      try {
        await updateGrants({
          id: scheme.id,
          grants: [{ role_name: roleName, permission, granted: checked }],
        }).unwrap();
      } catch {
        // revert on failure
        setGrantsState(prev => ({ ...prev, [key]: !checked }));
        void message.error(t('saveError', { defaultValue: 'Could not save changes' }));
      }
    },
    [updateGrants, t]
  );

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    try {
      const created = await createScheme({ name: values.name }).unwrap();
      void message.success(t('createSuccess', { defaultValue: 'Scheme created' }));
      createForm.resetFields();
      setCreateModalOpen(false);
      if (created?.id) {
        seededSchemeIdRef.current = null;
        setGrantsState({});
        setActiveSchemeId(created.id);
      }
    } catch {
      void message.error(t('saveError', { defaultValue: 'Could not save changes' }));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScheme(id).unwrap();
      void message.success(t('deleteSuccess', { defaultValue: 'Deleted' }));
      if (activeSchemeId === id) setActiveSchemeId(null);
    } catch {
      void message.error(t('saveError', { defaultValue: 'Could not save changes' }));
    }
  };

  // Default role names (always shown even before server responds)
  const DEFAULT_ROLE_NAMES = ['Owner', 'Admin', 'Team Lead', 'Member', 'Guest'];

  // Build table columns: fixed left "Permission" column + one column per role
  const roleColumns: TableColumnsType<{ permission: string }> = DEFAULT_ROLE_NAMES.map(role => ({
    title: role,
    key: role,
    align: 'center' as const,
    width: 110,
    render: (_: unknown, record: { permission: string }) => {
      const key = grantKey(role, record.permission);
      const checked = grantsState[key] ?? false;
      const disabled = activeScheme?.is_locked ?? true;
      return (
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={e => {
            if (activeScheme) {
              handleGrantChange(activeScheme, role, record.permission, e.target.checked);
            }
          }}
        />
      );
    },
  }));

  const tableColumns: TableColumnsType<{ permission: string }> = [
    {
      title: t('columnRole', { defaultValue: 'Permission' }),
      dataIndex: 'permission',
      key: 'permission',
      fixed: 'left',
      width: 180,
      render: (perm: string) =>
        t(PERMISSION_I18N[perm] ?? perm, { defaultValue: perm }),
    },
    ...roleColumns,
  ];

  const isCustomScheme = !!activeScheme && !activeScheme.is_default;
  const canEditPermissionList = isCustomScheme && !activeScheme?.is_locked;

  const removeColumn: TableColumnsType<{ permission: string }>[number] = {
    key: 'remove',
    align: 'center',
    width: 56,
    render: (_: unknown, record: { permission: string }) => {
      const permissionLabel = t(PERMISSION_I18N[record.permission] ?? record.permission, {
        defaultValue: record.permission,
      });
      return (
        <Popconfirm
          title={t('removePermissionConfirm', { defaultValue: 'Remove this permission from the scheme?' })}
          onConfirm={() => handleRemovePermission(record.permission)}
          okText={t('removePermissionOk', { defaultValue: 'Remove' })}
          cancelText={t('cancel', { defaultValue: 'Cancel' })}
        >
          <Tooltip title={t('removePermissionTooltip', { defaultValue: 'Remove from scheme' })}>
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('removePermissionAriaLabel', {
                permission: permissionLabel,
                defaultValue: 'Remove {{permission}}',
              })}
            />
          </Tooltip>
        </Popconfirm>
      );
    },
  };

  const visibleColumns = canEditPermissionList ? [...tableColumns, removeColumn] : tableColumns;

  // Default scheme shows the full list; custom schemes show only the permissions added to them
  const schemePermissions = new Set(Object.keys(grantsState).map(key => key.split('|||')[1]));
  const filterForScheme = (keys: readonly string[]) =>
    isCustomScheme ? keys.filter(key => schemePermissions.has(key)) : [...keys];

  const toTableData = (keys: readonly string[]) => keys.map(p => ({ permission: p, key: p }));

  // Organization permissions are organization-wide, so only the default scheme holds them
  const permissionSections = [
    {
      key: 'organization',
      title: t('orgPermissionsTitle', { defaultValue: 'Organization permissions' }),
      data: toTableData(isCustomScheme ? [] : ORGANIZATION_PERMISSION_KEYS),
    },
    {
      key: 'project',
      title: t('projectPermissionsTitle', { defaultValue: 'Project permissions' }),
      data: toTableData(filterForScheme(PROJECT_PERMISSION_KEYS)),
    },
  ].filter(section => section.data.length > 0);

  const toPermissionOptions = (keys: readonly string[]) =>
    keys
      .filter(key => !schemePermissions.has(key))
      .map(key => ({ value: key, label: t(PERMISSION_I18N[key] ?? key, { defaultValue: key }) }));

  const addPermissionOptions = [
    {
      label: t('projectPermissionsTitle', { defaultValue: 'Project permissions' }),
      options: toPermissionOptions(PROJECT_PERMISSION_KEYS),
    },
  ].filter(group => group.options.length > 0);

  const hasPermissionsToAdd = addPermissionOptions.length > 0;
  const isSchemeDetailLoading = schemeDetailLoading && Object.keys(grantsState).length === 0;

  if (loading) return <Spin />;

  return (
    <div>
      <Flex
        justify="space-between"
        align="center"
        gap={8}
        wrap="wrap"
        style={{ marginBottom: token.margin }}
      >
        {/* Scheme selector */}
        <Flex
          gap={8}
          wrap="wrap"
          role="group"
          aria-label={t('schemeSelectorLabel', { defaultValue: 'Select a permission scheme' })}
        >
          {schemes.map(scheme => {
            const isActive = scheme.id === activeId;
            return (
              <Button
                key={scheme.id}
                size="small"
                type={isActive ? 'primary' : 'default'}
                aria-pressed={isActive}
                icon={scheme.is_locked ? <LockOutlined /> : undefined}
                onClick={() => {
                  setActiveSchemeId(scheme.id);
                  seededSchemeIdRef.current = null; // allow re-seed for the new scheme
                  setGrantsState({});
                }}
              >
                {scheme.name}
              </Button>
            );
          })}
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            {t('newSchemeButton', { defaultValue: 'New Scheme' })}
          </Button>
        </Flex>
      </Flex>

      {/* Permission matrix tables */}
      <Spin spinning={isSchemeDetailLoading}>
        {!isSchemeDetailLoading && permissionSections.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('emptySchemeDescription', {
              defaultValue: 'This scheme has no permissions yet. Add permissions from the Default list.',
            })}
          >
            {canEditPermissionList && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddPermissionsModalOpen(true)}
              >
                {t('addFromDefaultButton', { defaultValue: 'Add from Default' })}
              </Button>
            )}
          </Empty>
        ) : (
          <Flex vertical gap={token.margin}>
            {permissionSections.map(section => (
              <div key={section.key}>
                <Text strong style={{ display: 'block', marginBottom: token.marginXS }}>
                  {section.title}
                </Text>
                <Table
                  size="small"
                  dataSource={section.data}
                  columns={visibleColumns}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  style={{ borderRadius: token.borderRadius }}
                />
              </div>
            ))}
            {canEditPermissionList && (
              <Button
                size="small"
                icon={<PlusOutlined />}
                disabled={!hasPermissionsToAdd}
                onClick={() => setAddPermissionsModalOpen(true)}
                style={{ alignSelf: 'flex-start' }}
              >
                {t('addFromDefaultButton', { defaultValue: 'Add from Default' })}
              </Button>
            )}
          </Flex>
        )}
      </Spin>

      {/* Add permissions from default list modal */}
      <Modal
        open={addPermissionsModalOpen}
        title={t('addFromDefaultTitle', { defaultValue: 'Add permissions from Default' })}
        onOk={handleAddPermissions}
        onCancel={handleCloseAddPermissions}
        okText={t('addPermissionsOk', { defaultValue: 'Add' })}
        cancelText={t('cancel', { defaultValue: 'Cancel' })}
        okButtonProps={{ disabled: selectedPermissions.length === 0 }}
        confirmLoading={isAddingPermissions}
      >
        <Flex vertical gap={token.marginXS}>
          <Text type="secondary">
            {t('addFromDefaultHint', {
              defaultValue: 'Selected permissions are added with the same role access as the Default scheme. You can change them afterwards.',
            })}
          </Text>
          <Select
            mode="multiple"
            allowClear
            style={{ width: '100%' }}
            value={selectedPermissions}
            onChange={setSelectedPermissions}
            options={addPermissionOptions}
            placeholder={t('addFromDefaultPlaceholder', { defaultValue: 'Select permissions' })}
            aria-label={t('addFromDefaultPlaceholder', { defaultValue: 'Select permissions' })}
          />
          <Button
            type="link"
            size="small"
            style={{ alignSelf: 'flex-start', padding: 0 }}
            onClick={() =>
              setSelectedPermissions(addPermissionOptions.flatMap(group => group.options.map(o => o.value)))
            }
          >
            {t('selectAllPermissions', { defaultValue: 'Select all' })}
          </Button>
        </Flex>
      </Modal>

      {/* Create scheme modal */}
      <Modal
        open={createModalOpen}
        title={t('schemeCreateTitle', { defaultValue: 'Create Permission Scheme' })}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        okText={t('create', { defaultValue: 'Create' })}
        cancelText={t('cancel', { defaultValue: 'Cancel' })}
        confirmLoading={isCreating}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label={t('schemeNameLabel', { defaultValue: 'Scheme name' })}
            rules={[{ required: true, message: t('schemeNameRequired', { defaultValue: 'Scheme name is required' }) }]}
          >
            <Input
              placeholder={t('schemeNamePlaceholder', { defaultValue: 'Enter scheme name' })}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 2 — ProjectsSection
// ---------------------------------------------------------------------------

interface ProjectsSectionProps {
  schemes: IPermissionScheme[];
}

const ProjectsSection: React.FC<ProjectsSectionProps> = ({ schemes }) => {
  const { t } = useTranslation('admin-center/roles-permissions');
  const { token } = theme.useToken();

  const { data: projects = [], isLoading, isError, refetch } = useGetTeamProjectSchemesQuery();
  const [assignProjectScheme] = useAssignProjectSchemeMutation();

  const [searchText, setSearchText] = useState('');
  // Unsaved/optimistic overrides on top of the server value: projectId → schemeId | null
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});

  const getSchemeId = (project: ITeamProjectScheme) =>
    project.id in assignments ? assignments[project.id] : project.scheme_id;

  const handleAssign = async (project: ITeamProjectScheme, schemeId: string | null) => {
    const previousSchemeId = getSchemeId(project);
    setAssignments(prev => ({ ...prev, [project.id]: schemeId }));
    try {
      await assignProjectScheme({ projectId: project.id, scheme_id: schemeId }).unwrap();
    } catch {
      setAssignments(prev => ({ ...prev, [project.id]: previousSchemeId }));
      void message.error(t('saveError', { defaultValue: 'Could not save changes' }));
    }
  };

  const columns: TableColumnsType<ITeamProjectScheme> = [
    {
      title: t('projectColumnName', { defaultValue: 'Project' }),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text>{name}</Text>,
    },
    {
      title: t('projectColumnScheme', { defaultValue: 'Permission Scheme' }),
      key: 'scheme',
      width: 260,
      render: (_: unknown, record: ITeamProjectScheme) => (
        <Select
          size="small"
          style={{ width: 220 }}
          allowClear
          placeholder={t('projectSchemeDefault', { defaultValue: 'Default (not migrated)' })}
          value={getSchemeId(record) ?? undefined}
          onChange={val => handleAssign(record, val ?? null)}
          options={schemes.map(s => ({ label: s.name, value: s.id }))}
          aria-label={t('projectSchemeAriaLabel', {
            project: record.name,
            defaultValue: 'Permission scheme for {{project}}',
          })}
        />
      ),
    },
  ];

  if (isLoading) return <Spin />;

  if (isError) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('projectsLoadError', { defaultValue: 'Could not load projects' })}
      >
        <Button size="small" onClick={() => refetch()}>
          {t('retry', { defaultValue: 'Retry' })}
        </Button>
      </Empty>
    );
  }

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredProjects = normalizedSearch
    ? projects.filter(project => project.name.toLowerCase().includes(normalizedSearch))
    : projects;

  return (
    <Flex vertical gap={token.marginSM}>
      <Input.Search
        allowClear
        size="small"
        style={{ maxWidth: 280 }}
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        placeholder={t('projectSearchPlaceholder', { defaultValue: 'Search projects' })}
        aria-label={t('projectSearchPlaceholder', { defaultValue: 'Search projects' })}
      />
      <Table
        size="small"
        dataSource={filteredProjects}
        columns={columns}
        rowKey="id"
        pagination={{
          defaultPageSize: 10,
          size: 'small',
          showSizeChanger: true,
          showTotal: total =>
            t('projectsTotal', { count: total, defaultValue: '{{count}} projects' }),
        }}
        locale={{ emptyText: t('noProjects', { defaultValue: 'No projects found' }) }}
        style={{ borderRadius: token.borderRadius }}
      />
    </Flex>
  );
};
