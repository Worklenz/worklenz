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
    useDeleteClientMutation,
    useBulkDeleteClientsMutation,
    useBulkUpdateClientsMutation,
  } from '@/api/client-portal/client-portal-api';
  import { TempClientPortalClientType } from '@/types/client-portal/temp-client-portal.types';
  import { useState } from 'react';
  import './clients-table.css';
  
  const { Search } = Input;
  const { Option } = Select;
  
  const ClientsTable = () => {
  // localization
  const { t } = useTranslation('client-portal-clients');

  // Get state from Redux
  const {
    filters,
    pagination,
  } = useAppSelector((state) => state.clientsPortalReducer.clientsReducer);
  
  const dispatch = useAppDispatch();

  // Local state for bulk operations
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // Local state for invitation functionality
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [currentClientId, setCurrentClientId] = useState<string>('');

  // RTK Query hooks
  const { 
    data: clientsData, 
    isLoading, 
    error, 
    refetch 
  } = useGetClientsQuery({
    page: pagination.page,
    limit: pagination.limit,
    search: filters.search,
    status: filters.status,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  const [deleteClient, { isLoading: isDeleting }] = useDeleteClientMutation();
  const [bulkDeleteClients, { isLoading: isBulkDeleting }] = useBulkDeleteClientsMutation();
  const [bulkUpdateClients, { isLoading: isBulkUpdating }] = useBulkUpdateClientsMutation();

  // Use API data - handle the ServerResponse wrapper
  const displayClients = clientsData?.body?.clients || [];
  const totalClients = clientsData?.body?.total || 0;
  
  // Handle error state
  if (error) {
    return (
      <Card>
        <Alert
          message={t('errorLoadingClients')}
          description={t('errorLoadingClientsDescription')}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  // Handle empty state
  if (!displayClients || displayClients.length === 0) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {t('noClientsTitle')}
              </Typography.Title>
              <Typography.Text type="secondary">
                {t('noClientsDescription')}
              </Typography.Text>
            </div>
          }
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            padding: '40px 0'
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              // TODO: Open add client modal/drawer
              console.log('Add client clicked');
            }}
          >
            {t('addClientButton')}
          </Button>
        </Empty>
      </Card>
    );
  }

  // Handle search
  const handleSearch = (value: string) => {
    dispatch(setSearchFilter(value));
  };

  // Handle status filter
  const handleStatusFilter = (value: string) => {
    dispatch(setStatusFilter(value));
  };

  // Handle sorting
  const handleTableChange: TableProps<ClientPortalClient | TempClientPortalClientType>['onChange'] = (pagination, filters, sorter) => {
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
    dispatch(setPage(page));
    dispatch(setLimit(pageSize));
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    setSelectedRowKeys([]);
  };

  // Handle delete client
  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteClient(clientId).unwrap();
      message.success(t('deleteClientSuccessMessage') || 'Client deleted successfully');
    } catch (error) {
      message.error(t('deleteClientErrorMessage') || 'Failed to delete client');
    }
  };

  // Handle delete client with confirmation
  const handleDeleteClientWithConfirmation = (clientId: string) => {
    // Create a temporary confirmation dialog
    const confirmDelete = () => {
      handleDeleteClient(clientId);
    };
    
    // Use Ant Design's Modal.confirm for better UX
    Modal.confirm({
      title: t('deleteConfirmationTitle') || 'Delete Client',
      content: t('deleteConfirmationDescription') || 'Are you sure you want to delete this client? This action cannot be undone.',
      okText: t('deleteConfirmationOk') || 'Delete',
      cancelText: t('deleteConfirmationCancel') || 'Cancel',
      okType: 'danger',
      onOk: confirmDelete,
    });
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('selectClientsToDelete') || 'Please select clients to delete');
      return;
    }

    try {
      setBulkActionLoading(true);
      await bulkDeleteClients({ client_ids: selectedRowKeys }).unwrap();
      message.success(t('bulkDeleteSuccessMessage') || 'Selected clients deleted successfully');
      setSelectedRowKeys([]);
    } catch (error) {
      message.error(t('bulkDeleteErrorMessage') || 'Failed to delete selected clients');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async (status: 'active' | 'inactive' | 'pending') => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('selectClientsToUpdate') || 'Please select clients to update');
      return;
    }

    try {
      setBulkActionLoading(true);
      await bulkUpdateClients({ 
        client_ids: selectedRowKeys,
        status 
      }).unwrap();
      message.success(t('bulkUpdateSuccessMessage') || 'Selected clients updated successfully');
      setSelectedRowKeys([]);
    } catch (error) {
      message.error(t('bulkUpdateErrorMessage') || 'Failed to update selected clients');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Handle invitation link generation
  const handleGenerateInviteLink = async (clientId: string) => {
    setCurrentClientId(clientId);
    setIsGeneratingLink(true);
    
    try {
      const response = await fetch('/api/clients/portal/generate-invitation-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`, // Adjust based on your auth system
        },
        body: JSON.stringify({ clientId }),
      });
      
      const data = await response.json();
      
      if (data.done) {
        if (data.body?.isExistingUser) {
          // Handle existing Worklenz user
          message.success({
            content: (
              <div>
                <div>{data.body.message}</div>
                {data.body.portalUrl && (
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    Portal URL: <a href={data.body.portalUrl} target="_blank" rel="noopener noreferrer">{data.body.portalUrl}</a>
                  </div>
                )}
              </div>
            ),
            duration: 8,
          });
          // Refresh the client list to show updated status
          refetch();
        } else if (data.body?.invitationLink) {
          // Handle new user invitation
          setInvitationLink(data.body.invitationLink);
          setInviteModalOpen(true);
          message.success('Invitation link generated successfully!');
        } else {
          message.error('Failed to generate invitation link');
        }
      } else {
        message.error('Failed to generate invitation link');
      }
    } catch (error) {
      console.error('Failed to generate invitation link:', error);
      message.error('Failed to generate invitation link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyInvitationLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      message.success('Invitation link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      message.error('Failed to copy link to clipboard');
    }
  };

  const closeInviteModal = () => {
    setInviteModalOpen(false);
    setInvitationLink('');
    setCurrentClientId('');
  };

  // Handle row selection
  const handleRowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys as string[]);
    },
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'red';
      case 'pending':
        return 'orange';
      default:
        return 'default';
    }
  };

  // Bulk action menu items
  const bulkActionMenuItems = [
    {
      key: 'activate',
      label: t('activateSelected') || 'Activate Selected',
      onClick: () => handleBulkStatusUpdate('active'),
    },
    {
      key: 'deactivate',
      label: t('deactivateSelected') || 'Deactivate Selected',
      onClick: () => handleBulkStatusUpdate('inactive'),
    },
    {
      key: 'pending',
      label: t('markPendingSelected') || 'Mark Pending',
      onClick: () => handleBulkStatusUpdate('pending'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'delete',
      label: t('deleteSelected') || 'Delete Selected',
      danger: true,
      onClick: handleBulkDelete,
    },
  ];

  // Get action menu items for each row
  const getActionMenuItems = (record: any) => {
    const menuItems = [
      {
        key: 'view',
        label: t('viewDetailsTooltip') || 'View Details',
        icon: <EyeOutlined />,
        onClick: () => dispatch(toggleClientDetailsDrawer(record.id)),
      },
      {
        key: 'edit',
        label: t('editClientTooltip') || 'Edit Client',
        icon: <EditOutlined />,
        onClick: () => dispatch(toggleEditClientDrawer(record.id)),
      },
    ];

    // Show invite link only if client hasn't accepted invite yet
    // pending = invitation not accepted, active = invitation accepted or already signed up
    if (record.status === 'pending' || record.status === 'inactive') {
      menuItems.push({
        key: 'invite',
        label: t('inviteClientTooltip') || 'Generate Invite Link',
        icon: <LinkOutlined />,
        onClick: () => handleGenerateInviteLink(record.id),
      });
    }

    menuItems.push(
      {
        key: 'projects',
        label: t('manageProjectsTooltip') || 'Manage Projects',
        icon: <SettingOutlined />,
        onClick: () => dispatch(toggleClientSettingsDrawer(record.id)),
      },
      {
        key: 'team',
        label: t('manageTeamTooltip') || 'Manage Team',
        icon: <ShareAltOutlined />,
        onClick: () => dispatch(toggleClientTeamsDrawer(record.id)),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'delete',
        label: t('deleteTooltip') || 'Delete Client',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDeleteClientWithConfirmation(record.id),
      }
    );

    return menuItems;
  };

  // table columns
  const columns: TableProps<ClientPortalClient | TempClientPortalClientType>['columns'] = [
    {
      key: 'client',
      title: t('clientColumn'),
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
      key: 'status',
      title: t('statusColumn') || 'Status',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} style={{ textTransform: 'capitalize' }}>
          {status || 'active'}
        </Tag>
      ),
      width: 120,
    },
    {
      key: 'assignedProjects',
      title: t('assignedProjectsColumn'),
      dataIndex: 'assigned_projects_count',
      sorter: true,
      render: (count: number) => (
        <Typography.Text>{count || 0}</Typography.Text>
      ),
      width: 160,
    },
    {
      key: 'teamMembers',
      title: t('teamMembersColumn') || 'Team Members',
      dataIndex: 'team_members',
      render: (teamMembers: any[]) => (
        <Typography.Text>{teamMembers?.length || 0}</Typography.Text>
      ),
      width: 140,
    },
    {
      key: 'actionBtns',
      title: t('actionBtnsColumn'),
      width: 80,
      render: (_, record) => (
        <div className="action-buttons-container" style={{ opacity: 0, transition: 'opacity 0.2s' }}>
          <Dropdown
            menu={{ items: getActionMenuItems(record) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              shape="default"
              icon={<MoreOutlined />}
              size="small"
              type="text"
            />
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
            placeholder={t('searchClientsPlaceholder') || 'Search clients...'}
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            defaultValue={filters.search}
          />
          
          <Select
            placeholder={t('statusFilterPlaceholder') || 'Filter by status'}
            allowClear
            style={{ width: 150 }}
            onChange={handleStatusFilter}
            value={filters.status}
          >
            <Option value="active">{t('statusActive') || 'Active'}</Option>
            <Option value="inactive">{t('statusInactive') || 'Inactive'}</Option>
            <Option value="pending">{t('statusPending') || 'Pending'}</Option>
          </Select>
          
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isLoading}
          >
            {t('refreshButton') || 'Refresh'}
          </Button>
          
          <Button
            icon={<FilterOutlined />}
            onClick={() => dispatch(clearFilters())}
          >
            {t('clearFiltersButton') || 'Clear Filters'}
          </Button>

          {/* Bulk Actions */}
          {selectedRowKeys.length > 0 && (
            <Space>
              <Typography.Text type="secondary">
                {t('selectedCount') || 'Selected'}: {selectedRowKeys.length}
              </Typography.Text>
              <Dropdown
                menu={{ items: bulkActionMenuItems }}
                trigger={['click']}
              >
                <Button
                  icon={<MoreOutlined />}
                  loading={bulkActionLoading}
                >
                  {t('bulkActions') || 'Bulk Actions'}
                </Button>
              </Dropdown>
            </Space>
          )}
        </Flex> 
      </Flex>

      {/* Table */}
      <Spin spinning={isLoading}>
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
          onRow={(record) => ({
            onMouseEnter: (e) => {
              const row = e.currentTarget;
              const actionContainer = row.querySelector('.action-buttons-container') as HTMLElement;
              if (actionContainer) {
                actionContainer.style.opacity = '1';
              }
            },
            onMouseLeave: (e) => {
              const row = e.currentTarget;
              const actionContainer = row.querySelector('.action-buttons-container') as HTMLElement;
              if (actionContainer) {
                actionContainer.style.opacity = '0';
              }
            },
          })}
        />
      </Spin>

      {/* Pagination */}
      {totalClients > 0 && (
        <Flex justify="end" style={{ marginTop: 16 }}>
          <Pagination
            current={pagination.page}
            pageSize={pagination.limit}
            total={totalClients}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) =>
              `${t('paginationText') || 'Showing'} ${range[0]}-${range[1]} ${t('ofText') || 'of'} ${total} ${t('clientsText') || 'clients'}`
            }
            onChange={handlePaginationChange}
            onShowSizeChange={handlePaginationChange}
          />
        </Flex>
      )}
      
      {/* Invitation Modal */}
      <Modal
        title="Invitation Link Generated"
        open={inviteModalOpen}
        onCancel={closeInviteModal}
        footer={[
          <Button key="close" onClick={closeInviteModal}>
            Close
          </Button>,
          <Button
            key="copy"
            type="primary"
            icon={<CopyOutlined />}
            onClick={copyInvitationLink}
          >
            Copy Link
          </Button>,
        ]}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">
            Share this link with the client to invite them to create their portal account. The link will expire in 7 days.
          </Typography.Text>
        </div>
        
        <div style={{ 
          padding: 12, 
          backgroundColor: '#f5f5f5', 
          borderRadius: 6, 
          marginBottom: 16,
          wordBreak: 'break-all'
        }}>
          <Typography.Text copyable={{ text: invitationLink }}>
            {invitationLink}
          </Typography.Text>
        </div>
        
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          When the client clicks this link, they'll be able to create their portal account and access their projects and services.
        </Typography.Text>
      </Modal>
    </Card>
  );
};

export default ClientsTable;
  