import {
  DeleteOutlined,
  SettingOutlined,
  ShareAltOutlined,
  EyeOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  LinkOutlined,
  CopyOutlined,
  MailOutlined,
  QuestionCircleOutlined,
} from '@/shared/antd-imports';
import { CheckOutlined, DownOutlined } from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Flex,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import type { MenuProps, TableProps } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import PortalStatusTag from '@/components/client-portal/PortalStatusTag';
import TablePagination from '@/components/TablePagination';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_client_portal_share } from '@/shared/worklenz-analytics-events';
import { AvatarNamesMap } from '@/shared/constants';
import { fromNow } from '@/utils/dateUtils';
import './clients-table.css';
import {
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
import {
  ClientPortalClient,
  clientPortalApi,
  useGetClientsQuery,
  useDeactivateClientMutation,
  useUpdateClientMutation,
  useBulkDeactivateClientsMutation,
  useGenerateClientInvitationLinkMutation,
  useResendClientInvitationMutation,
} from '@/api/client-portal/client-portal-api';
import { ClientInvitationLinkModal } from './ClientInvitationLinkModal';
import { clientWorkspacePath } from './workspace/workspace-helpers';
import {
  ClientField,
  PAGE_SIZE_OPTIONS,
  PORTAL_STATUS_FILTER_VALUES,
  getClientInitials,
  getLastActivity,
  getPocNames,
  getPortalStatusKey,
  loadVisibleFields,
  saveVisibleFields,
} from './clients-list-helpers';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;
const FIELD_KEYS: ClientField[] = ['lastActivity', 'phone', 'poc', 'company'];

const ClientsTable = () => {
  const { t } = useTranslation('client-portal-clients');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { filters, pagination } = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer
  );

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [visibleFields, setVisibleFields] = useState(loadVisibleFields);
  const [isFieldsMenuOpen, setIsFieldsMenuOpen] = useState(false);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitationLink, setInvitationLink] = useState('');
  const [currentClientId, setCurrentClientId] = useState('');

  // The card must hug its content (no dead space below the pagination bar when a page has
  // few rows) while never growing past the room actually left on screen (so a full page of
  // rows scrolls inside the table instead of the whole page scrolling). Neither the card nor
  // its table can simply flex-fill that space, since a flex-filled box doesn't shrink back
  // down when its content is short. Instead we measure the true ceiling directly — from the
  // bottom of the page's own container up to wherever the card happens to start — and cap
  // the table's scroll area at exactly what's left after its header and the pagination bar,
  // letting the table (and therefore the card) size itself naturally under that cap.
  const containerRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(360);

  const measureTableHeight = useCallback(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) return;
    const theadHeight = card.querySelector('.ant-table-thead')?.getBoundingClientRect().height ?? 0;
    const paginationHeight = paginationRef.current?.getBoundingClientRect().height ?? 0;
    const maxAvailable = container.getBoundingClientRect().bottom - card.getBoundingClientRect().top;
    const available = maxAvailable - theadHeight - paginationHeight;
    setTableScrollY(Math.max(160, Math.round(available)));
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current || !cardRef.current) return;

    measureTableHeight();
    const observer = new ResizeObserver(measureTableHeight);
    observer.observe(containerRef.current);
    if (filtersRef.current) observer.observe(filtersRef.current);
    if (paginationRef.current) observer.observe(paginationRef.current);
    return () => observer.disconnect();
  }, [measureTableHeight]);

  const queryParams = useMemo(
    () => ({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search,
      status: filters.status !== 'all' ? filters.status : undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    }),
    [
      pagination.page,
      pagination.limit,
      filters.search,
      filters.status,
      filters.sortBy,
      filters.sortOrder,
    ]
  );

  const {
    data: clientsData,
    isFetching,
    error,
    refetch,
  } = useGetClientsQuery(queryParams, { refetchOnMountOrArgChange: true });

  const [deactivateClient] = useDeactivateClientMutation();
  const [updateClient] = useUpdateClientMutation();
  const [bulkDeactivateClients] = useBulkDeactivateClientsMutation();
  const [generateInvitationLink] = useGenerateClientInvitationLinkMutation();
  const [resendInvitation] = useResendClientInvitationMutation();

  const displayClients = clientsData?.body?.clients ?? [];
  const totalClients = clientsData?.body?.total ?? 0;
  const hasActiveFilters = Boolean(filters.search) || filters.status !== 'all';
  const showsTable = displayClients.length > 0 || isFetching;

  // The table's header row only exists once the table itself (rather than the empty state)
  // renders, so re-measure when that swap happens — the wrapper's own box doesn't change size
  // when its content does, so the ResizeObserver above wouldn't otherwise notice.
  useLayoutEffect(() => {
    measureTableHeight();
  }, [measureTableHeight, showsTable]);

  // Search runs on the server, so wait for a pause in typing instead of querying per keystroke.
  useEffect(() => {
    if (searchInput === filters.search) return undefined;

    const timer = setTimeout(() => dispatch(setSearchFilter(searchInput)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dispatch, searchInput, filters.search]);

  // Row selection is per page of results: a bulk action must never reach rows the user can't see.
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [pagination.page, pagination.limit, filters.search, filters.status]);

  const fieldLabels: Record<ClientField, string> = {
    lastActivity: t('lastActivityColumn', { defaultValue: 'Last activity' }),
    phone: t('phoneColumn', { defaultValue: 'Phone' }),
    poc: t('pocColumn', { defaultValue: 'POC' }),
    company: t('companyColumn', { defaultValue: 'Company' }),
  };

  const portalStatusLabel = (status: string) =>
    t(`portalStatus.${status}`, {
      defaultValue:
        status === 'active'
          ? 'Active'
          : status === 'expired'
            ? 'Expired'
            : status === 'invited'
              ? 'Invited'
              : 'Not Invited',
    });

  const handleToggleField = (field: ClientField) => {
    setVisibleFields(previous => {
      const next = { ...previous, [field]: !previous[field] };
      saveVisibleFields(next);
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    dispatch(clearFilters());
  };

  const handleTableChange: TableProps<ClientPortalClient>['onChange'] = (
    _pagination,
    tableFilters,
    sorter
  ) => {
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;

    if (sort?.field && sort.order) {
      dispatch(setSortBy(String(sort.field)));
      dispatch(setSortOrder(sort.order === 'ascend' ? 'asc' : 'desc'));
    } else {
      dispatch(setSortBy('name'));
      dispatch(setSortOrder('asc'));
    }

    // The Portal Status column filter is a second way to set the same status the toolbar Select
    // controls (matching Recurring Tasks' Recur Type column filter). Only one status applies at a
    // time, so a multi-tick selection keeps just the first value.
    const statusValues = (tableFilters.portalStatus as string[] | null) || [];
    const nextStatus = statusValues.length > 0 ? statusValues[0] : 'all';
    if (nextStatus !== filters.status) {
      dispatch(setStatusFilter(nextStatus));
    }

    // Re-sorting (or re-filtering) reshuffles which rows land on which page, so always land back
    // on page 1 rather than showing page N of a now-different ordering.
    dispatch(setPage(1));
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    // Changing the page size resets to the first page (handled by the slice).
    if (pageSize !== pagination.limit) {
      dispatch(setLimit(pageSize));
      return;
    }
    dispatch(setPage(page));
  };

  const handleDeactivateClient = async (clientId: string) => {
    try {
      await deactivateClient(clientId).unwrap();
      message.success(
        t('deactivateClientSuccessMessage', { defaultValue: 'Client deactivated successfully' })
      );
    } catch {
      message.error(
        t('deactivateClientErrorMessage', { defaultValue: 'Failed to deactivate client' })
      );
    }
  };

  const handleActivateClient = async (clientId: string) => {
    // Flip the status right away so the row menu changes without waiting for the refetch.
    const patch = dispatch(
      clientPortalApi.util.updateQueryData('getClients', queryParams, draft => {
        const target = draft?.body?.clients?.find(client => client.id === clientId);
        if (target) target.status = 'active';
      })
    );

    try {
      await updateClient({ id: clientId, data: { status: 'active' } }).unwrap();
      message.success(
        t('activateClientSuccessMessage', { defaultValue: 'Client activated successfully' })
      );
    } catch (activateError) {
      patch.undo();
      const errorData = (activateError as { data?: { message?: string } })?.data;
      message.error(
        errorData?.message ||
          t('activateClientErrorMessage', { defaultValue: 'Failed to activate client' })
      );
    }
  };

  const confirmDeactivateClient = (clientId: string) => {
    Modal.confirm({
      title: t('deactivateConfirmationTitle', { defaultValue: 'Deactivate Client' }),
      content: t('deactivateConfirmationDescription', {
        defaultValue:
          'Are you sure you want to deactivate this client? They will lose access to the portal, but all data will be preserved.',
      }),
      okText: t('deactivateConfirmationOk', { defaultValue: 'Deactivate' }),
      cancelText: t('deactivateConfirmationCancel', { defaultValue: 'Cancel' }),
      okType: 'danger',
      onOk: () => handleDeactivateClient(clientId),
    });
  };

  const confirmActivateClient = (clientId: string) => {
    Modal.confirm({
      title: t('activateConfirmationTitle', { defaultValue: 'Activate Client' }),
      content: t('activateConfirmationDescription', {
        defaultValue:
          'Are you sure you want to activate this client? They will regain access to the portal.',
      }),
      okText: t('activateConfirmationOk', { defaultValue: 'Activate' }),
      cancelText: t('activateConfirmationCancel', { defaultValue: 'Cancel' }),
      onOk: () => handleActivateClient(clientId),
    });
  };

  const handleGenerateInviteLink = async (clientId: string) => {
    setCurrentClientId(clientId);

    try {
      const result = await generateInvitationLink({ clientId }).unwrap();

      if (result.body?.isExistingUser) {
        message.success({
          content: (
            <div>
              <div>{result.body.message}</div>
              {result.body.portalUrl && (
                <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextSecondary }}>
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
      } else if (result.body?.invitationLink) {
        setInvitationLink(result.body.invitationLink);
        setInviteModalOpen(true);
        message.success(
          t('inviteLinkGeneratedSuccess', {
            defaultValue: 'Invitation link generated successfully!',
          })
        );
      } else {
        message.error(
          t('inviteLinkGeneratedError', { defaultValue: 'Failed to generate invitation link' })
        );
      }
    } catch (inviteError) {
      // RTK Query errors can have different structures, so check multiple paths
      const failure = inviteError as {
        data?: { message?: string; body?: { errorCode?: string } };
        message?: string;
      };
      const errorCode = failure?.data?.body?.errorCode;

      if (errorCode === 'EMAIL_REQUIRED') {
        Modal.confirm({
          title: t('emailRequiredTitle', { defaultValue: 'Email Required' }),
          content: (
            <div>
              <p>
                {t('emailRequiredMessage', {
                  defaultValue:
                    'This client does not have an email address. An email is required to invite them to the portal.',
                })}
              </p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                {t('emailRequiredQuestion', {
                  defaultValue: 'Would you like to add an email address and invite them again?',
                })}
              </p>
            </div>
          ),
          okText: t('addEmailButton', { defaultValue: 'Add Email & Invite' }),
          cancelText: t('cancelButton', { defaultValue: 'Cancel' }),
          onOk: () => {
            dispatch(toggleEditClientDrawer(clientId));
          },
        });
      } else {
        message.error(
          failure?.data?.message ||
            failure?.message ||
            t('inviteLinkGeneratedError', { defaultValue: 'Failed to generate invitation link' })
        );
      }
    }
  };

  const handleCopyInvitationLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);

      trackMixpanelEvent(evt_client_portal_share, {
        client_id: currentClientId,
        share_method: 'copy_link',
      });

      message.success(
        t('invitationLinkCopiedSuccess', { defaultValue: 'Invitation link copied to clipboard!' })
      );
    } catch {
      message.error(
        t('invitationLinkCopyError', { defaultValue: 'Failed to copy link to clipboard' })
      );
    }
  };

  const handleCloseInviteModal = () => {
    setInviteModalOpen(false);
    setInvitationLink('');
    setCurrentClientId('');
  };

  const handleResendInvitation = async (clientId: string) => {
    try {
      const result = await resendInvitation({ clientId }).unwrap();

      if (result.body?.emailSent) {
        message.success(
          t('resendInvitationSuccess', { defaultValue: 'Invitation email sent successfully!' })
        );
      } else {
        message.error(
          t('resendInvitationError', { defaultValue: 'Failed to send invitation email' })
        );
      }
    } catch {
      message.error(t('resendInvitationError', { defaultValue: 'Failed to send invitation email' }));
    }
  };

  const handleBulkInvite = async () => {
    const selectedClients = displayClients.filter(client => selectedRowKeys.includes(client.id));
    // Clients that already joined, or have no email to send to, can't be invited.
    const eligibleClients = selectedClients.filter(
      client => getPortalStatusKey(client) !== 'active' && Boolean(client.email?.trim())
    );
    const skippedCount = selectedClients.length - eligibleClients.length;

    if (eligibleClients.length === 0) {
      message.warning(
        t('bulkInviteNothingToSend', {
          defaultValue:
            'None of the selected clients can be invited. They already have portal access or have no email address.',
        })
      );
      return;
    }

    setBulkActionLoading(true);
    let sentCount = 0;
    let failedCount = 0;

    for (const client of eligibleClients) {
      try {
        const result = await resendInvitation({ clientId: client.id }).unwrap();
        if (result.body?.emailSent) {
          sentCount += 1;
        } else {
          failedCount += 1;
        }
      } catch {
        failedCount += 1;
      }
    }

    setBulkActionLoading(false);
    setSelectedRowKeys([]);

    if (sentCount > 0) {
      message.success(
        t('bulkInviteSentMessage', {
          count: sentCount,
          defaultValue_one: '{{count}} invitation sent',
          defaultValue_other: '{{count}} invitations sent',
        })
      );
    }
    if (failedCount > 0) {
      message.error(
        t('bulkInviteFailedMessage', {
          count: failedCount,
          defaultValue_one: '{{count}} invitation failed to send',
          defaultValue_other: '{{count}} invitations failed to send',
        })
      );
    }
    if (skippedCount > 0) {
      message.info(
        t('bulkInviteSkippedMessage', {
          count: skippedCount,
          defaultValue_one: '{{count}} client skipped (already active or no email)',
          defaultValue_other: '{{count}} clients skipped (already active or no email)',
        })
      );
    }
  };

  const handleBulkDeactivate = async () => {
    try {
      setBulkActionLoading(true);
      await bulkDeactivateClients({ client_ids: selectedRowKeys }).unwrap();
      message.success(
        t('bulkDeactivateSuccessMessage', {
          defaultValue: 'Selected clients deactivated successfully',
        })
      );
      setSelectedRowKeys([]);
    } catch {
      message.error(
        t('bulkDeactivateErrorMessage', { defaultValue: 'Failed to deactivate selected clients' })
      );
    } finally {
      setBulkActionLoading(false);
    }
  };

  const confirmBulkDeactivate = () => {
    Modal.confirm({
      title: t('deactivateConfirmationTitle', { defaultValue: 'Deactivate Client' }),
      content: t('bulkDeactivateConfirmationDescription', {
        count: selectedRowKeys.length,
        defaultValue_one:
          'Deactivate the {{count}} selected client? They will lose access to the portal, but all data will be preserved.',
        defaultValue_other:
          'Deactivate the {{count}} selected clients? They will lose access to the portal, but all data will be preserved.',
      }),
      okText: t('deactivateConfirmationOk', { defaultValue: 'Deactivate' }),
      cancelText: t('deactivateConfirmationCancel', { defaultValue: 'Cancel' }),
      okType: 'danger',
      onOk: handleBulkDeactivate,
    });
  };

  const bulkActionMenuItems: MenuProps['items'] = [
    {
      key: 'invite',
      label: t('inviteSelectedToPortal', { defaultValue: 'Send Portal Invitations' }),
      icon: <LinkOutlined />,
      onClick: handleBulkInvite,
    },
    { type: 'divider' },
    {
      key: 'deactivate',
      label: t('deactivateSelected', { defaultValue: 'Deactivate Selected' }),
      danger: true,
      onClick: confirmBulkDeactivate,
    },
  ];

  const fieldMenuItems: MenuProps['items'] = FIELD_KEYS.map(field => ({
    key: field,
    label: fieldLabels[field],
    icon: visibleFields[field] ? <CheckOutlined /> : <span style={{ display: 'inline-block', width: 14 }} />,
  }));

  const getActionMenuItems = (record: ClientPortalClient): MenuProps['items'] => {
    const status = getPortalStatusKey(record);

    const items: MenuProps['items'] = [
      {
        key: 'view',
        label: t('viewDetailsTooltip', { defaultValue: 'View Details' }),
        icon: <EyeOutlined />,
        onClick: () => navigate(clientWorkspacePath(record.id)),
      },
      {
        key: 'edit',
        label: t('editClientTooltip', { defaultValue: 'Edit Client' }),
        icon: <EditOutlined />,
        onClick: () => dispatch(toggleEditClientDrawer(record.id)),
      },
    ];

    if (status === 'not_invited') {
      items.push({
        key: 'invite',
        label: t('inviteToPortalTooltip', { defaultValue: 'Invite to Portal' }),
        icon: <LinkOutlined />,
        onClick: () => handleGenerateInviteLink(record.id),
      });
    } else if (status === 'expired') {
      items.push({
        key: 'resend',
        label: t('resendInvitationTooltip', { defaultValue: 'Resend Invitation' }),
        icon: <ShareAltOutlined />,
        onClick: () => handleGenerateInviteLink(record.id),
      });
    } else if (status === 'invited') {
      items.push(
        {
          key: 'resendEmail',
          label: t('resendInviteEmailTooltip', { defaultValue: 'Resend Invite Email' }),
          icon: <MailOutlined />,
          onClick: () => handleResendInvitation(record.id),
        },
        {
          key: 'copyInvite',
          label: t('copyInviteLinkTooltip', { defaultValue: 'Copy Invitation Link' }),
          icon: <CopyOutlined />,
          onClick: () => handleGenerateInviteLink(record.id),
        }
      );
    }

    items.push(
      {
        key: 'projects',
        label: t('manageProjectsTooltip', { defaultValue: 'Manage Projects' }),
        icon: <SettingOutlined />,
        onClick: () => navigate(clientWorkspacePath(record.id, 'projects')),
      },
      { type: 'divider' },
      record.status === 'inactive'
        ? {
            key: 'activate',
            label: t('activateTooltip', { defaultValue: 'Activate Client' }),
            icon: <EditOutlined />,
            onClick: () => confirmActivateClient(record.id),
          }
        : {
            key: 'deactivate',
            label: t('deactivateTooltip', { defaultValue: 'Deactivate Client' }),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => confirmDeactivateClient(record.id),
          }
    );

    return items;
  };

  const renderLastActivity = (record: ClientPortalClient) => {
    const activity = getLastActivity(record);

    if (activity.kind === 'signedIn') return fromNow(activity.at);
    if (activity.kind === 'invited') {
      return t('lastActivityInvited', {
        time: fromNow(activity.at),
        defaultValue: 'Invited {{time}}',
      });
    }
    return t('lastActivityNever', { defaultValue: 'Never signed in' });
  };

  // Plain (non-secondary) text so every data cell in the table reads at the same color/weight.
  const renderTableText = (value?: string | null) => <Text>{value?.trim() ? value : '—'}</Text>;

  const sortOrderFor = (field: string): 'ascend' | 'descend' | null =>
    filters.sortBy === field ? (filters.sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const columns: TableProps<ClientPortalClient>['columns'] = [
    {
      key: 'client',
      title: t('clientColumn', { defaultValue: 'Client' }),
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortOrderFor('name'),
      onCell: () => ({ style: { minWidth: 220 } }),
      render: (_name: string, record) => {
        const initial = getClientInitials(record.name).charAt(0);
        return (
          <Flex align="center" gap={10}>
            <Avatar
              size={28}
              style={{
                flexShrink: 0,
                color: token.colorWhite,
                backgroundColor: AvatarNamesMap[initial],
              }}
            >
              {initial}
            </Avatar>
            <Text
              style={{ textTransform: 'capitalize', cursor: 'pointer' }}
              onClick={event => {
                event.stopPropagation();
                navigate(clientWorkspacePath(record.id));
              }}
            >
              {record.name?.trim() || '-'}
            </Text>
          </Flex>
        );
      },
    },
    {
      key: 'contact',
      title: t('contactColumn', { defaultValue: 'Contact' }),
      dataIndex: 'email',
      render: (email: string) => renderTableText(email),
    },
    {
      key: 'portalStatus',
      title: (
        <Flex align="center" gap={6}>
          <span>{t('portalStatusColumn', { defaultValue: 'Portal Status' })}</span>
          <Tooltip
            title={
              <Flex vertical gap={4}>
                <Text style={{ color: 'inherit' }}>
                  {t('portalStatusHelp.active', {
                    defaultValue: 'Active: Client has accepted and can access the portal.',
                  })}
                </Text>
                <Text style={{ color: 'inherit' }}>
                  {t('portalStatusHelp.invited', {
                    defaultValue:
                      'Invited: Invitation was sent and is still valid, but not yet accepted.',
                  })}
                </Text>
                <Text style={{ color: 'inherit' }}>
                  {t('portalStatusHelp.notInvited', {
                    defaultValue: 'Not Invited: No invitation has been sent yet.',
                  })}
                </Text>
                <Text style={{ color: 'inherit' }}>
                  {t('portalStatusHelp.expired', {
                    defaultValue: 'Expired: Previous invitation expired and should be resent.',
                  })}
                </Text>
              </Flex>
            }
          >
            <QuestionCircleOutlined
              tabIndex={0}
              aria-label={t('portalStatusHelpLabel', { defaultValue: 'About portal statuses' })}
              style={{ color: token.colorTextTertiary, fontSize: 12 }}
            />
          </Tooltip>
        </Flex>
      ),
      dataIndex: 'portal_status_key',
      sorter: true,
      sortOrder: sortOrderFor('portal_status_key'),
      filters: PORTAL_STATUS_FILTER_VALUES.filter(value => value !== 'all').map(value => ({
        text: portalStatusLabel(value),
        value,
      })),
      filteredValue: filters.status !== 'all' ? [filters.status] : null,
      render: (_: unknown, record) => {
        const status = getPortalStatusKey(record);
        return <PortalStatusTag showDot status={status} label={portalStatusLabel(status)} />;
      },
    },
    ...(visibleFields.lastActivity
      ? [
          {
            key: 'lastActivity',
            title: fieldLabels.lastActivity,
            dataIndex: 'last_login_at',
            sorter: true,
            sortOrder: sortOrderFor('last_login_at'),
            render: (_: unknown, record: ClientPortalClient) => (
              <Text>{renderLastActivity(record)}</Text>
            ),
          },
        ]
      : []),
    ...(visibleFields.phone
      ? [
          {
            key: 'phone',
            title: fieldLabels.phone,
            dataIndex: 'phone',
            render: (phone: string) => renderTableText(phone),
          },
        ]
      : []),
    ...(visibleFields.poc
      ? [
          {
            key: 'poc',
            title: fieldLabels.poc,
            dataIndex: 'poc_names',
            sorter: true,
            sortOrder: sortOrderFor('poc_names'),
            render: (_pocs: unknown, record: ClientPortalClient) => {
              const pocs = getPocNames(record);
              if (pocs.length === 0) return renderTableText(null);

              // A company can have several POCs: show the first and count the rest.
              return (
                <Tooltip title={pocs.length > 1 ? pocs.join(', ') : undefined}>
                  <Text>
                    {pocs[0]}
                    {pocs.length > 1 && (
                      <Text type="secondary">{` +${pocs.length - 1}`}</Text>
                    )}
                  </Text>
                </Tooltip>
              );
            },
          },
        ]
      : []),
    ...(visibleFields.company
      ? [
          {
            key: 'company',
            title: fieldLabels.company,
            dataIndex: 'company_name',
            sorter: true,
            sortOrder: sortOrderFor('company_name'),
            render: (companyName: string) =>
              companyName?.trim() ? <Text>{companyName}</Text> : renderTableText(null),
          },
        ]
      : []),
    {
      key: 'assignedProjects',
      title: t('projectsColumn', { defaultValue: 'Projects' }),
      dataIndex: 'assigned_projects_count',
      sorter: true,
      sortOrder: sortOrderFor('assigned_projects_count'),
      render: (count: number) => <Text>{count || 0}</Text>,
    },
    {
      key: 'actionBtns',
      title: t('actionBtnsColumn', { defaultValue: 'Actions' }),
      width: 88,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <div onClick={event => event.stopPropagation()}>
          <Dropdown
            menu={{ items: getActionMenuItems(record) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={t('rowActionsLabel', {
                name: record.name,
                defaultValue: 'Actions for {{name}}',
              })}
            />
          </Dropdown>
        </div>
      ),
    },
  ];

  const renderEmptyState = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ padding: '40px 0' }}
      description={
        <Flex vertical gap={4}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('noClientsTitle', { defaultValue: 'No Clients Found' })}
          </Typography.Title>
          <Text type="secondary">
            {hasActiveFilters
              ? t('noClientsMatchingFilters', {
                  defaultValue: 'No clients match the current filters.',
                })
              : t('noClientsDescription', {
                  defaultValue:
                    "You haven't added any clients yet. Add your first client to start managing their portal access.",
                })}
          </Text>
        </Flex>
      }
    >
      {hasActiveFilters ? (
        <Button onClick={handleClearFilters}>
          {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
        </Button>
      ) : (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => dispatch(toggleAddClientDrawer())}>
          {t('addClientButton', { defaultValue: 'Add new' })}
        </Button>
      )}
    </Empty>
  );

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('errorLoadingClients', { defaultValue: 'Error Loading Clients' })}
        description={t('errorLoadingClientsDescription', {
          defaultValue: 'There was an error loading your clients. Please try again later.',
        })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <Flex
        ref={filtersRef}
        gap={12}
        align="center"
        wrap="wrap"
        style={{ marginBottom: 16, flexShrink: 0 }}
      >
        <Input.Search
          allowClear
          size="small"
          placeholder={t('searchClientsPlaceholder', {
            defaultValue: 'Search clients or companies...',
          })}
          aria-label={t('searchClientsPlaceholder', {
            defaultValue: 'Search clients or companies...',
          })}
          style={{ width: '100%', maxWidth: 280 }}
          value={searchInput}
          onChange={event => setSearchInput(event.target.value)}
          onSearch={value => {
            setSearchInput(value);
            dispatch(setSearchFilter(value));
          }}
        />

        {hasActiveFilters && (
          <Button type="link" size="small" onClick={handleClearFilters}>
            {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
          </Button>
        )}

        <Select
          size="small"
          aria-label={t('portalStatusFilterPlaceholder', { defaultValue: 'Filter by status' })}
          style={{ width: 170, marginInlineStart: 'auto' }}
          value={filters.status}
          onChange={value => dispatch(setStatusFilter(value))}
          options={PORTAL_STATUS_FILTER_VALUES.map(value => ({
            value,
            label:
              value === 'all'
                ? t('allStatusesOption', { defaultValue: 'All statuses' })
                : portalStatusLabel(value),
          }))}
        />

        <Dropdown
          open={isFieldsMenuOpen}
          trigger={['click']}
          // Keep the menu open while toggling several fields; close on outside click or Escape.
          onOpenChange={(nextOpen, info) => {
            if (info.source === 'trigger' || nextOpen) setIsFieldsMenuOpen(nextOpen);
          }}
          menu={{
            items: fieldMenuItems,
            selectable: false,
            onClick: ({ key }) => handleToggleField(key as ClientField),
          }}
        >
          <Button size="small" icon={<DownOutlined />} iconPosition="end">
            {t('showFieldsButton', { defaultValue: 'Fields' })}
          </Button>
        </Dropdown>

        {selectedRowKeys.length > 0 && (
          <Space>
            <Text type="secondary">
              {t('selectedCount', { defaultValue: 'Selected' })}: {selectedRowKeys.length}
            </Text>
            <Dropdown menu={{ items: bulkActionMenuItems }} trigger={['click']}>
              <Button size="small" icon={<MoreOutlined />} loading={bulkActionLoading}>
                {t('bulkActions', { defaultValue: 'Bulk Actions' })}
              </Button>
            </Dropdown>
          </Space>
        )}
      </Flex>

      <Card
        ref={cardRef}
        className="clients-table"
        style={{ borderRadius: 8, overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        {showsTable ? (
          <Table<ClientPortalClient>
            columns={columns}
            dataSource={displayClients}
            rowKey="id"
            size="middle"
            sticky
            pagination={false}
            loading={isFetching}
            onChange={handleTableChange}
            rowSelection={{
              selectedRowKeys,
              onChange: keys => setSelectedRowKeys(keys as string[]),
            }}
            scroll={{ x: 'max-content', y: tableScrollY }}
            onRow={record => ({
              onClick: () => navigate(clientWorkspacePath(record.id)),
              style: { cursor: 'pointer' },
            })}
          />
        ) : (
          renderEmptyState()
        )}

        <div ref={paginationRef}>
          <TablePagination
            page={pagination.page}
            pageSize={pagination.limit}
            total={totalClients}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={handlePaginationChange}
            rowsPerPageLabel={t('rowsPerPageLabel', { defaultValue: 'Rows per page:' })}
            renderSummary={(range, total) => {
              const [from, to] = range.split('-');
              return t('paginationSummary', {
                from,
                to,
                total,
                defaultValue: 'Showing {{from}}-{{to}} of {{total}} clients',
              });
            }}
          />
        </div>
      </Card>

      <ClientInvitationLinkModal
        open={inviteModalOpen}
        link={invitationLink}
        onClose={handleCloseInviteModal}
        onCopy={handleCopyInvitationLink}
      />
    </div>
  );
};

export default ClientsTable;
