import {
  DeleteOutlined,
  SettingOutlined,
  ShareAltOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  LinkOutlined,
  CopyOutlined,
  MailOutlined,
} from '@/shared/antd-imports';
import {
  Button,
  Card,
  Flex,
  Table,
  Typography,
  Input,
  Select,
  Tag,
  Spin,
  Pagination,
  Dropdown,
  message,
  Space,
  Modal,
  Empty,
  Alert,
} from '@/shared/antd-imports';
import { TableProps } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  toggleClientSettingsDrawer,
  toggleClientTeamsDrawer,
  toggleClientDetailsDrawer,
  toggleEditClientDrawer,
  toggleAddClientDrawer,
  setSearchFilter,
  setStatusFilter,
  setSortBy,
  setSortOrder,
  setPage,
  setLimit,
  clearFilters,
} from '@/features/clients-portal/clients/clients-slice';
import { ClientPortalClient } from '@/api/client-portal/client-portal-api';
import {
  useGetClientsQuery,
  useDeactivateClientMutation,
  useBulkDeactivateClientsMutation,
  useBulkUpdateClientsMutation,
  useGenerateClientInvitationLinkMutation,
  useResendClientInvitationMutation,
  clientPortalApi,
} from '@/api/client-portal/client-portal-api';
import { TempClientPortalClientType } from '@/types/client-portal/temp-client-portal.types';
import { useState, useMemo } from 'react';
import { themeWiseColor } from '@/utils/themeWiseColor';
import './clients-table.css';

const { Search } = Input;
const { Option } = Select;

const ClientsTable = () => {
  // localization
  const { t } = useTranslation('client-portal-clients');

  // Get state from Redux
  const { filters, pagination } = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer
  );

  // Get theme mode for dark mode support
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  const dispatch = useAppDispatch();

  // Local state for bulk operations
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Local state for invitation functionality
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [currentClientId, setCurrentClientId] = useState<string>('');

  // Memoize query parameters to ensure RTK Query detects changes correctly
  const queryParams = useMemo(
    () => ({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search,
      status: filters.status === 'all' ? undefined : filters.status,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    }),
    [pagination.page, pagination.limit, filters.search, filters.status, filters.sortBy, filters.sortOrder]
  );

  // RTK Query hooks
  const {
    data: clientsData,
    isLoading,
    error,
    refetch,
  } = useGetClientsQuery(queryParams, {
    refetchOnMountOrArgChange: true, // Ensure query refetches when parameters change
  });

  const [deactivateClient, { isLoading: isDeactivating }] = useDeactivateClientMutation();
  const [bulkDeactivateClients, { isLoading: isBulkDeactivating }] = useBulkDeactivateClientsMutation();
  const [bulkUpdateClients, { isLoading: isBulkUpdating }] = useBulkUpdateClientsMutation();
  const [generateInvitationLink] = useGenerateClientInvitationLinkMutation();
  const [resendInvitation, { isLoading: isResendingInvitation }] = useResendClientInvitationMutation();

  // Use API data - handle the ServerResponse wrapper
  const displayClients = clientsData?.body?.clients || [];
  const totalClients = clientsData?.body?.total || 0;

  // Handle error state
  if (error) {
    return (
      <Card>
        <Alert
          message={t('errorLoadingClients', { defaultValue: 'Error Loading Clients' })}
          description={t('errorLoadingClientsDescription', { defaultValue: 'There was an error loading your clients. Please try again later.' })}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  // Render empty state with filters still visible
  const renderEmptyState = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div>
          <Typography.Title level={4} style={{ marginBottom: 8 }}>
            {t('noClientsTitle', { defaultValue: 'No Clients Found' })}
          </Typography.Title>
          <Typography.Text type="secondary">
            {filters.search || filters.status !== 'all'
              ? t('noClientsMatchingFilters', { defaultValue: 'No clients match the current filters.' })
              : t('noClientsDescription', { defaultValue: 'You haven\'t added any clients yet. Add your first client to start managing their portal access.' })}
          </Typography.Text>
        </div>
      }
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px 0',
      }}
    >
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          dispatch(toggleAddClientDrawer());
        }}
      >
        {t('addClientButton', { defaultValue: 'Add Client' })}
      </Button>
    </Empty>
  );

  // Handle search
  const handleSearch = (value: string) => {
    dispatch(setSearchFilter(value));
  };

  // Handle status filter
  const handleStatusFilter = (value: string) => {
    dispatch(setStatusFilter(value));
  };

  // Handle sorting
  const handleTableChange: TableProps<
    ClientPortalClient | TempClientPortalClientType
  >['onChange'] = (pagination, filters, sorter) => {
    if (Array.isArray(sorter)) {
      const sort = sorter[0];
      if (sort?.field && sort?.order) {
        dispatch(setSortBy(sort.field as string));
        dispatch(setSortOrder(sort.order === 'ascend' ? 'asc' : 'desc'));
      }
    }
  };

  // Handle pagination
  const handlePaginationChange = (page: number, pageSize: number) => {
    // Only update what actually changed to avoid unnecessary resets
    // If we always call setLimit, it will reset page to 1 even when limit hasn't changed
    if (page !== pagination.page) {
      dispatch(setPage(page));
    }
    if (pageSize !== pagination.limit) {
      dispatch(setLimit(pageSize));
    }
  };

  // Handle page size change separately (resets to page 1)
  const handlePageSizeChange = (_current: number, size: number) => {
    dispatch(setLimit(size)); // This will reset page to 1 in the slice
  };

  // Handle refresh
  const handleRefresh = () => {
    // Invalidate the Clients cache to force refetch of all client queries
    // This will refresh both the table data and the parent component's statistics
    dispatch(clientPortalApi.util.invalidateTags(['Clients']));
    // Also explicitly refetch the current query for immediate feedback
    refetch();
    setSelectedRowKeys([]);
  };

  // Handle deactivate client
  const handleDeactivateClient = async (clientId: string) => {
    try {
      await deactivateClient(clientId).unwrap();
      message.success(t('deactivateClientSuccessMessage', { defaultValue: 'Client deactivated successfully' }));
    } catch (error) {
      message.error(t('deactivateClientErrorMessage', { defaultValue: 'Failed to deactivate client' }));
    }
  };

  // Handle deactivate client with confirmation
  const handleDeactivateClientWithConfirmation = (clientId: string) => {
    // Create a temporary confirmation dialog
    const confirmDeactivate = () => {
      handleDeactivateClient(clientId);
    };

    // Use Ant Design's Modal.confirm for better UX
    Modal.confirm({
      title: t('deactivateConfirmationTitle', { defaultValue: 'Deactivate Client' }),
      content: t('deactivateConfirmationDescription', { defaultValue: 'Are you sure you want to deactivate this client? They will lose access to the portal, but all data will be preserved.' }),
      okText: t('deactivateConfirmationOk', { defaultValue: 'Deactivate' }),
      cancelText: t('deactivateConfirmationCancel', { defaultValue: 'Cancel' }),
      okType: 'danger',
      onOk: confirmDeactivate,
    });
  };

  // Handle bulk deactivate
  const handleBulkDeactivate = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('selectClientsToDeactivate', { defaultValue: 'Please select clients to deactivate' }));
      return;
    }

    try {
      setBulkActionLoading(true);
      await bulkDeactivateClients({ client_ids: selectedRowKeys }).unwrap();
      message.success(t('bulkDeactivateSuccessMessage', { defaultValue: 'Selected clients deactivated successfully' }));
      setSelectedRowKeys([]);
    } catch (error) {
      message.error(t('bulkDeactivateErrorMessage', { defaultValue: 'Failed to deactivate selected clients' }));
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async (status: 'active' | 'inactive' | 'pending') => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('selectClientsToUpdate', { defaultValue: 'Please select clients to update' }));
      return;
    }

    try {
      setBulkActionLoading(true);
      await bulkUpdateClients({
        client_ids: selectedRowKeys,
        status,
      }).unwrap();
      message.success(t('bulkUpdateSuccessMessage', { defaultValue: 'Selected clients updated successfully' }));
      setSelectedRowKeys([]);
    } catch (error) {
      message.error(t('bulkUpdateErrorMessage', { defaultValue: 'Failed to update selected clients' }));
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Handle invitation link generation
  const handleGenerateInviteLink = async (clientId: string) => {
    setCurrentClientId(clientId);
    setIsGeneratingLink(true);

    try {
      const result = await generateInvitationLink({ clientId }).unwrap();

      if (result.body?.isExistingUser) {
        // Handle existing Worklenz user
        message.success({
          content: (
            <div>
              <div>{result.body.message}</div>
              {result.body.portalUrl && (
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                  {t('portalUrlLabel', { defaultValue: 'Portal URL:' })}{' '}
                  <a href={result.body.portalUrl} target="_blank" rel="noopener noreferrer">
                    {result.body.portalUrl}
                  </a>
                </div>
              )}
            </div>
          ),
          duration: 8,
        });
        // Refresh the client list to show updated status
        refetch();
      } else if (result.body?.invitationLink) {
        // Handle new user invitation
        setInvitationLink(result.body.invitationLink);
        setInviteModalOpen(true);
        message.success(t('inviteLinkGeneratedSuccess', { defaultValue: 'Invitation link generated successfully!' }));
      } else {
        message.error(t('inviteLinkGeneratedError', { defaultValue: 'Failed to generate invitation link' }));
      }
    } catch (error: any) {
      console.error('Failed to generate invitation link:', error);
      
      // Check if error is due to missing email
      // RTK Query errors can have different structures, so check multiple paths
      const errorData = error?.data?.body || error?.data || error?.response?.data?.body || error?.response?.data;
      const errorCode = errorData?.errorCode;
      
      if (errorCode === 'EMAIL_REQUIRED') {
        // Show confirmation modal asking if user wants to add email
        Modal.confirm({
          title: t('emailRequiredTitle', { defaultValue: 'Email Required' }),
          content: (
            <div>
              <p>{t('emailRequiredMessage', { 
                defaultValue: 'This client does not have an email address. An email is required to invite them to the portal.'
              })}</p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                {t('emailRequiredQuestion', { defaultValue: 'Would you like to add an email address and invite them again?' })}
              </p>
            </div>
          ),
          okText: t('addEmailButton', { defaultValue: 'Add Email & Invite' }),
          cancelText: t('cancelButton', { defaultValue: 'Cancel' }),
          okType: 'primary',
          onOk: () => {
            // Open edit client drawer
            dispatch(toggleEditClientDrawer(clientId));
          },
        });
      } else {
        // Show generic error for other cases
        const errorMessage = error?.data?.message || 
                            error?.response?.data?.message ||
                            error?.message || 
                            t('inviteLinkGeneratedError', { defaultValue: 'Failed to generate invitation link' });
        message.error(errorMessage);
      }
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyInvitationLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      message.success(t('invitationLinkCopiedSuccess', { defaultValue: 'Invitation link copied to clipboard!' }));
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      message.error(t('invitationLinkCopyError', { defaultValue: 'Failed to copy link to clipboard' }));
    }
  };

  const closeInviteModal = () => {
    setInviteModalOpen(false);
    setInvitationLink('');
    setCurrentClientId('');
  };

  // Handle resend invitation email
  const handleResendInvitation = async (clientId: string) => {
    try {
      const result = await resendInvitation({ clientId }).unwrap();

      if (result.body?.emailSent) {
        message.success(t('resendInvitationSuccess', { defaultValue: 'Invitation email sent successfully!' }));
        refetch();
      } else {
        message.error(t('resendInvitationError', { defaultValue: 'Failed to send invitation email' }));
      }
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      message.error(t('resendInvitationError', { defaultValue: 'Failed to send invitation email' }));
    }
  };

  // Handle row selection
  const handleRowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys as string[]);
    },
  };

  // Get portal status details
  const getPortalStatus = (record: any) => {
    // If portal_status exists in the record, use it and ensure label is translated
    if (record.portal_status) {
      const status = record.portal_status;
      // If it's already an object with status, translate the label
      if (status.status) {
        return {
          ...status,
          label: t(`portalStatus.${status.status}`, { defaultValue: status.status === 'active' ? 'Active' : status.status === 'expired' ? 'Expired' : status.status === 'invited' ? 'Invited' : 'Not Invited' }),
        };
      }
      // If it's just a status string, create the full object
      return {
        status: status,
        label: t(`portalStatus.${status}`, { defaultValue: status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : status === 'invited' ? 'Invited' : 'Not Invited' }),
        color: status === 'active' ? 'green' : status === 'expired' ? 'red' : status === 'invited' ? 'orange' : 'default',
      };
    }

    // Otherwise, infer from available data
    if (record.has_portal_access) {
      return { status: 'active', label: t('portalStatus.active', { defaultValue: 'Active' }), color: 'green' };
    } else if (record.invitation_sent_at && !record.invitation_accepted) {
      const invitationDate = new Date(record.invitation_sent_at);
      const expiryDate = new Date(invitationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const isExpired = expiryDate < new Date();

      if (isExpired) {
        return { status: 'expired', label: t('portalStatus.expired', { defaultValue: 'Expired' }), color: 'red' };
      }
      return { status: 'invited', label: t('portalStatus.invited', { defaultValue: 'Invited' }), color: 'orange' };
    }

    return { status: 'not_invited', label: t('portalStatus.not_invited', { defaultValue: 'Not Invited' }), color: 'default' };
  };

  // Handle bulk portal invitations
  const handleBulkInvite = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('selectClientsToInvite', { defaultValue: 'Please select clients to invite' }));
      return;
    }

    try {
      setBulkActionLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (const clientId of selectedRowKeys) {
        try {
          await handleGenerateInviteLink(clientId);
          successCount++;
        } catch (error) {
          failCount++;
          console.error(`Failed to invite client ${clientId}:`, error);
        }
      }

      if (successCount > 0) {
        message.success(`${successCount} ${t('bulkInviteSuccessMessage', { defaultValue: 'invitation(s) generated successfully' })}`);
      }
      if (failCount > 0) {
        message.warning(`${failCount} ${t('bulkInvitePartialFailMessage', { defaultValue: 'invitation(s) failed' })}`);
      }

      setSelectedRowKeys([]);
      refetch();
    } catch (error) {
      message.error(t('bulkInviteErrorMessage', { defaultValue: 'Failed to generate invitations' }));
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk action menu items
  const bulkActionMenuItems = [
    {
      key: 'invite',
      label: t('inviteSelectedToPortal', { defaultValue: 'Send Portal Invitations' }),
      icon: <LinkOutlined />,
      onClick: handleBulkInvite,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'deactivate',
      label: t('deactivateSelected', { defaultValue: 'Deactivate Selected' }),
      danger: true,
      onClick: handleBulkDeactivate,
    },
  ];

  // Get action menu items for each row
  const getActionMenuItems = (record: any) => {
    const portalStatus = getPortalStatus(record);

    const menuItems: any[] = [
      {
        key: 'view',
        label: t('viewDetailsTooltip', { defaultValue: 'View Details' }),
        icon: <EyeOutlined />,
        onClick: () => {
          dispatch(toggleClientDetailsDrawer(record.id));
        },
      },
      {
        key: 'edit',
        label: t('editClientTooltip', { defaultValue: 'Edit Client' }),
        icon: <EditOutlined />,
        onClick: () => {
          dispatch(toggleEditClientDrawer(record.id));
        },
      },
    ];

    // Portal invitation actions based on status
    if (portalStatus.status === 'not_invited') {
      menuItems.push({
        key: 'invite',
        label: t('inviteToPortalTooltip', { defaultValue: 'Invite to Portal' }),
        icon: <LinkOutlined />,
        onClick: () => {
          handleGenerateInviteLink(record.id);
        },
      });
    } else if (portalStatus.status === 'expired') {
      menuItems.push({
        key: 'resend',
        label: t('resendInvitationTooltip', { defaultValue: 'Resend Invitation' }),
        icon: <ShareAltOutlined />,
        onClick: () => {
          handleGenerateInviteLink(record.id);
        },
      });
    } else if (portalStatus.status === 'invited') {
      menuItems.push(
        {
          key: 'resendEmail',
          label: t('resendInviteEmailTooltip', { defaultValue: 'Resend Invite Email' }),
          icon: <MailOutlined />,
          onClick: () => {
            handleResendInvitation(record.id);
          },
        },
        {
          key: 'copyInvite',
          label: t('copyInviteLinkTooltip', { defaultValue: 'Copy Invitation Link' }),
          icon: <CopyOutlined />,
          onClick: () => {
            handleGenerateInviteLink(record.id);
          },
        }
      );
    }

    menuItems.push(
      {
        key: 'projects',
        label: t('manageProjectsTooltip', { defaultValue: 'Manage Projects' }),
        icon: <SettingOutlined />,
        onClick: () => {
          dispatch(toggleClientSettingsDrawer(record.id));
        },
      },
      {
        key: 'team',
        label: t('manageTeamTooltip', { defaultValue: 'Manage Team' }),
        icon: <ShareAltOutlined />,
        onClick: () => {
          dispatch(toggleClientTeamsDrawer(record.id));
        },
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'deactivate',
        label: t('deactivateTooltip', { defaultValue: 'Deactivate Client' }),
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => {
          handleDeactivateClientWithConfirmation(record.id);
        },
      }
    );

    return menuItems;
  };

  // table columns
  const columns: TableProps<ClientPortalClient | TempClientPortalClientType>['columns'] = [
    {
      key: 'client',
      title: t('clientColumn', { defaultValue: 'Client' }),
      dataIndex: 'name',
      sorter: true,
      render: (name: string, record: any) => (
        <Flex vertical gap={4}>
          <Typography.Text strong style={{ textTransform: 'capitalize' }}>
            {name}
          </Typography.Text>
          {record.email && (
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              {record.email}
            </Typography.Text>
          )}
          {record.company_name && (
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              {record.company_name}
            </Typography.Text>
          )}
        </Flex>
      ),
      onCell: () => ({
        style: { minWidth: 320 },
      }),
    },
    {
      key: 'portalStatus',
      title: t('portalStatusColumn', { defaultValue: 'Portal Status' }),
      dataIndex: 'portal_status',
      render: (_: any, record: any) => {
        const portalStatus = getPortalStatus(record);
        return (
          <Tag color={portalStatus.color} style={{ textTransform: 'capitalize' }}>
            {portalStatus.label}
          </Tag>
        );
      },
      width: 140,
    },
    {
      key: 'assignedProjects',
      title: t('assignedProjectsColumn', { defaultValue: 'Assigned Projects' }),
      dataIndex: 'assigned_projects_count',
      sorter: true,
      render: (count: number) => <Typography.Text>{count || 0}</Typography.Text>,
      width: 160,
    },
    {
      key: 'teamMembers',
      title: t('teamMembersColumn', { defaultValue: 'Team Members' }),
      dataIndex: 'team_members',
      render: (teamMembers: any[]) => <Typography.Text>{teamMembers?.length || 0}</Typography.Text>,
      width: 140,
    },
    {
      key: 'actionBtns',
      title: t('actionBtnsColumn', { defaultValue: 'Actions' }),
      width: 80,
      render: (_, record) => (
        <div
          className="action-buttons-container"
          style={{ opacity: 0, transition: 'opacity 0.2s' }}
          onClick={e => e.stopPropagation()}
        >
          <Dropdown
            menu={{ items: getActionMenuItems(record) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button shape="default" icon={<MoreOutlined />} size="small" type="text" />
          </Dropdown>
        </div>
      ),
      onCell: () => ({
        style: {
          width: 80,
          textAlign: 'center',
        },
      }),
    },
  ];

  return (
    <Card>
      {/* Filters and Search */}
      <Flex vertical gap={16} style={{ marginBottom: 16 }}>
        <Flex gap={16} align="center" wrap="wrap">
          <Search
            placeholder={t('searchClientsPlaceholder', { defaultValue: 'Search clients...' })}
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            defaultValue={filters.search}
          />

          <Select
            placeholder={t('statusFilterPlaceholder', { defaultValue: 'Filter by status' })}
            allowClear
            style={{ width: 180 }}
            onChange={handleStatusFilter}
            value={filters.status}
          >
            <Option value="all">{t('statusAll', { defaultValue: 'All' })}</Option>
            <Option value="active">{t('statusActive', { defaultValue: 'Active' })}</Option>
            <Option value="inactive">{t('statusInactive', { defaultValue: 'Inactive' })}</Option>
            <Option value="pending">{t('statusPending', { defaultValue: 'Pending' })}</Option>
          </Select>

          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isLoading}>
            {t('refreshButton', { defaultValue: 'Refresh' })}
          </Button>

          <Button icon={<FilterOutlined />} onClick={() => dispatch(clearFilters())}>
            {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
          </Button>

          {/* Bulk Actions */}
          {selectedRowKeys.length > 0 && (
            <Space>
              <Typography.Text type="secondary">
                {t('selectedCount', { defaultValue: 'Selected' })}: {selectedRowKeys.length}
              </Typography.Text>
              <Dropdown menu={{ items: bulkActionMenuItems }} trigger={['click']}>
                <Button icon={<MoreOutlined />} loading={bulkActionLoading}>
                  {t('bulkActions', { defaultValue: 'Bulk Actions' })}
                </Button>
              </Dropdown>
            </Space>
          )}
        </Flex>
      </Flex>

      {/* Table */}
      <Spin spinning={isLoading}>
        {displayClients && displayClients.length > 0 ? (
          <Table
            columns={columns}
            dataSource={displayClients}
            rowKey="id"
            pagination={false} // We'll handle pagination manually
            onChange={handleTableChange}
            rowSelection={handleRowSelection}
            scroll={{
              x: 'max-content',
            }}
            size="middle"
            onRow={record => ({
              onClick: () => {
                dispatch(toggleClientDetailsDrawer(record.id));
              },
              onMouseEnter: e => {
                const row = e.currentTarget;
                const actionContainer = row.querySelector('.action-buttons-container') as HTMLElement;
                if (actionContainer) {
                  actionContainer.style.opacity = '1';
                }
              },
              onMouseLeave: e => {
                const row = e.currentTarget;
                const actionContainer = row.querySelector('.action-buttons-container') as HTMLElement;
                if (actionContainer) {
                  actionContainer.style.opacity = '0';
                }
              },
              style: { cursor: 'pointer' },
            })}
          />
        ) : (
          renderEmptyState()
        )}
      </Spin>

      {/* Pagination */}
      {totalClients > 0 && (
        <Flex justify="end" style={{ marginTop: 16 }}>
          <Pagination
            current={pagination.page}
            pageSize={pagination.limit}
            total={totalClients}
            showSizeChanger
            showTotal={(total, range) =>
              `${t('paginationText', { defaultValue: 'Showing' })} ${range[0]}-${range[1]} ${t('ofText', { defaultValue: 'of' })} ${total} ${t('clientsText', { defaultValue: 'clients' })}`
            }
            onChange={handlePaginationChange}
            onShowSizeChange={handlePageSizeChange}
          />
        </Flex>
      )}

      {/* Invitation Modal */}
      <Modal
        title={t('invitationModalTitle', { defaultValue: 'Invitation Link Generated' })}
        open={inviteModalOpen}
        onCancel={closeInviteModal}
        footer={[
          <Button key="close" onClick={closeInviteModal}>
            {t('closeButton', { defaultValue: 'Close' })}
          </Button>,
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={copyInvitationLink}>
            {t('invitationModalCopyLink', { defaultValue: 'Copy Link' })}
          </Button>,
        ]}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">
            {t('invitationModalDescription', { defaultValue: 'Share this link with the client to invite them to create their portal account. The link will expire in 7 days.' })}
          </Typography.Text>
        </div>

        <div
          style={{
            padding: 12,
            backgroundColor: themeWiseColor('#f5f5f5', '#2a2a2a', themeMode),
            borderRadius: 6,
            marginBottom: 16,
            wordBreak: 'break-all',
            border: `1px solid ${themeWiseColor('#e8e8e8', '#404040', themeMode)}`,
          }}
        >
          <Typography.Text 
            copyable={{ text: invitationLink }}
            style={{ 
              color: themeWiseColor('rgba(0, 0, 0, 0.88)', 'rgba(255, 255, 255, 0.85)', themeMode)
            }}
          >
            {invitationLink}
          </Typography.Text>
        </div>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('invitationModalFooterText', {defaultValue: 'When the client clicks this link, they\'ll be able to create their portal account and access their projects and services.'})}
        </Typography.Text>
      </Modal>

    </Card>
  );
};

export default ClientsTable;
