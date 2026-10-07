import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  Alert,
  Button,
  Dropdown,
  Flex,
  Input,
  Spin,
  Tag,
  Typography,
  message,
  MoreOutlined,
  PlusOutlined,
} from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useGetTicketsQuery,
  useUpdateTicketStatusMutation,
  useGetTicketCustomStatusesQuery,
  useCreateTicketCustomStatusMutation,
  useDeleteTicketCustomStatusMutation,
} from '../../../api/client-portal/client-portal-api';
import { TICKET_BUILT_IN_STATUS_I18N, ticketPriorityColor } from './tickets-list-helpers';
import ConvertToTaskModal from './ConvertToTaskModal';

const COLUMN_WIDTH = 272;

const TicketCard = ({ ticket, onOpen, menuItems }: { ticket: any; onOpen: () => void; menuItems: MenuProps['items'] }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    background: 'var(--ant-color-bg-container, #fff)',
    border: '1px solid var(--ant-color-border, #d9d9d9)',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
    cursor: 'grab',
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Flex align="flex-start" justify="space-between" gap={4} style={{ marginBottom: 4 }}>
        <Typography.Text
          strong
          style={{ fontSize: 12, color: '#1677ff', cursor: 'pointer' }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {ticket.ticket_no}
        </Typography.Text>
        <div onPointerDown={e => e.stopPropagation()}>
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
          </Dropdown>
        </div>
      </Flex>
      <Typography.Text
        style={{ fontSize: 13, display: 'block', marginBottom: 4, cursor: 'pointer' }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          onOpen();
        }}
      >
        {ticket.subject}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginBottom: 6 }}>
        {ticket.client_name}
      </Typography.Text>
      <Tag color={ticketPriorityColor(ticket.priority)} style={{ margin: 0, fontSize: 10 }}>
        {ticket.priority}
      </Tag>
    </div>
  );
};

const StatusColumn = ({
  status,
  label,
  color,
  tickets,
  removable,
  onRemove,
  children,
}: {
  status: string;
  label: string;
  color: string;
  tickets: any[];
  removable: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      style={{
        width: COLUMN_WIDTH,
        flexShrink: 0,
        background: isOver ? 'var(--ant-color-primary-bg, #e6f4ff)' : 'var(--ant-color-fill-tertiary, #f5f5f5)',
        borderRadius: 10,
        padding: 10,
      }}
    >
      <Flex align="center" justify="space-between" style={{ marginBottom: 10, padding: '0 2px' }}>
        <Flex align="center" gap={6}>
          <Tag color={color} style={{ margin: 0 }}>
            {label}
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            {tickets.length}
          </Typography.Text>
        </Flex>
        {removable && (
          <Button type="text" size="small" onClick={onRemove}>
            {'✕'}
          </Button>
        )}
      </Flex>
      <div style={{ minHeight: 40 }}>{children}</div>
    </div>
  );
};

const TicketsBoard = () => {
  const { t } = useTranslation('client-portal-tickets');
  const { t: t2 } = useTranslation('client-portal-common');
  const navigate = useNavigate();

  const [addingStatus, setAddingStatus] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [convertingTicket, setConvertingTicket] = useState<any>(null);

  const { data: ticketsData, isFetching, error } = useGetTicketsQuery({
    page: 1,
    limit: 1000,
    sortBy: 'created_at',
    sortOrder: 'asc',
  });
  const { data: customStatusesData } = useGetTicketCustomStatusesQuery();
  const [updateStatus] = useUpdateTicketStatusMutation();
  const [createStatus, { isLoading: isCreatingStatus }] = useCreateTicketCustomStatusMutation();
  const [deleteStatus] = useDeleteTicketCustomStatusMutation();

  const tickets = (ticketsData?.body as any)?.data || [];
  const customStatuses = customStatusesData?.body ?? [];

  const statusColumns = useMemo(
    () => [
      {
        status: 'open',
        id: null,
        label: t2(TICKET_BUILT_IN_STATUS_I18N.open.key, { defaultValue: TICKET_BUILT_IN_STATUS_I18N.open.defaultValue }),
        color: 'default',
        builtIn: true,
      },
      {
        status: 'in_progress',
        id: null,
        label: t2(TICKET_BUILT_IN_STATUS_I18N.in_progress.key, {
          defaultValue: TICKET_BUILT_IN_STATUS_I18N.in_progress.defaultValue,
        }),
        color: 'blue',
        builtIn: true,
      },
      {
        status: 'resolved',
        id: null,
        label: t2(TICKET_BUILT_IN_STATUS_I18N.resolved.key, {
          defaultValue: TICKET_BUILT_IN_STATUS_I18N.resolved.defaultValue,
        }),
        color: 'green',
        builtIn: true,
      },
      ...customStatuses.map(s => ({ status: s.name, id: s.id, label: s.name, color: s.color, builtIn: false })),
    ],
    [customStatuses, t2]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const ticket = tickets.find((tkt: any) => tkt.id === active.id);
    const targetStatus = String(over.id);
    if (!ticket || ticket.status === targetStatus) return;
    try {
      await updateStatus({ id: ticket.id, status: targetStatus }).unwrap();
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(errorData?.message || t('statusUpdateError', { defaultValue: 'Failed to update status' }));
    }
  };

  const handleMarkResolved = async (ticket: any) => {
    try {
      await updateStatus({ id: ticket.id, status: 'resolved' }).unwrap();
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(errorData?.message || t('statusUpdateError', { defaultValue: 'Failed to update status' }));
    }
  };

  const handleRemoveStatus = async (statusId: string) => {
    try {
      await deleteStatus(statusId).unwrap();
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(
        errorData?.message || t('customStatusRemovedError', { defaultValue: 'Failed to remove custom status' })
      );
    }
  };

  const confirmAddStatus = async () => {
    const name = newStatusName.trim();
    if (!name) return;
    try {
      await createStatus({ name, color: 'default' }).unwrap();
      setNewStatusName('');
      setAddingStatus(false);
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(errorData?.message || t('customStatusAddedError', { defaultValue: 'Failed to add custom status' }));
    }
  };

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('errorLoadingTickets', { defaultValue: 'Error Loading Tickets' })}
      />
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: 200 }}>
      {isFetching && (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin />
        </Flex>
      )}

      <ConvertToTaskModal ticket={convertingTicket} onClose={() => setConvertingTicket(null)} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Flex gap={14} align="flex-start" style={{ overflowX: 'auto', paddingBottom: 8 }}>
          {statusColumns.map(column => {
            const columnTickets = tickets.filter((tkt: any) => tkt.status === column.status);
            return (
              <StatusColumn
                key={column.status}
                status={column.status}
                label={column.label}
                color={column.color}
                tickets={columnTickets}
                removable={!column.builtIn}
                onRemove={() => column.id && handleRemoveStatus(column.id)}
              >
                {columnTickets.map((ticket: any) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onOpen={() => navigate(`/worklenz/client-portal/ticketing/${ticket.id}`)}
                    menuItems={[
                      {
                        key: 'markResolved',
                        label: t('markAsResolvedButton', { defaultValue: 'Mark as Resolved' }),
                        disabled: ticket.status === 'resolved',
                        onClick: () => handleMarkResolved(ticket),
                      },
                      {
                        key: 'convertToTask',
                        label: t('convertToTaskButton', { defaultValue: 'Convert to Task' }),
                        disabled: Boolean(ticket.converted_task_id),
                        onClick: () => setConvertingTicket(ticket),
                      },
                    ]}
                  />
                ))}
                {columnTickets.length === 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', textAlign: 'center', padding: '10px 0' }}>
                    {t('noTicketsInColumn', { defaultValue: 'No tickets' })}
                  </Typography.Text>
                )}
              </StatusColumn>
            );
          })}

          <div style={{ width: 220, flexShrink: 0 }}>
            {addingStatus ? (
              <Flex vertical gap={8} style={{ background: 'var(--ant-color-fill-tertiary, #f5f5f5)', borderRadius: 10, padding: 10 }}>
                <Input
                  autoFocus
                  size="small"
                  maxLength={40}
                  placeholder={t('customStatusNamePlaceholder', { defaultValue: 'Status name' })}
                  value={newStatusName}
                  onChange={e => setNewStatusName(e.target.value)}
                  onPressEnter={confirmAddStatus}
                />
                <Flex gap={6}>
                  <Button type="primary" size="small" onClick={confirmAddStatus} loading={isCreatingStatus}>
                    {t('addCustomStatusButton', { defaultValue: 'Add' })}
                  </Button>
                  <Button size="small" onClick={() => { setAddingStatus(false); setNewStatusName(''); }}>
                    {t('cancelButton', { defaultValue: 'Cancel' })}
                  </Button>
                </Flex>
              </Flex>
            ) : (
              <Button icon={<PlusOutlined />} size="small" style={{ width: '100%' }} onClick={() => setAddingStatus(true)}>
                {t('addStatusButton', { defaultValue: 'Add Status' })}
              </Button>
            )}
          </div>
        </Flex>
      </DndContext>
    </div>
  );
};

export default TicketsBoard;
