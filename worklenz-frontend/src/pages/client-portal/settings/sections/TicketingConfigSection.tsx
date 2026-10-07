import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ColorPicker, Flex, Input, Popconfirm, Tag, Typography, message, theme, DeleteOutlined } from '@/shared/antd-imports';
import {
  useGetTicketCustomStatusesQuery,
  useCreateTicketCustomStatusMutation,
  useDeleteTicketCustomStatusMutation,
} from '@/api/client-portal/client-portal-api';
import { CLIENT_PORTAL_BRAND_COLORS } from '@/types/settings/client-portal-settings.types';
import {
  TICKET_BUILT_IN_STATUSES,
  TICKET_BUILT_IN_STATUS_I18N,
  ticketStatusColor,
} from '@/pages/client-portal/tickets/tickets-list-helpers';
import { SectionCard } from './SectionCard';

/** Lives in Portal Settings rather than on the Ticketing List toolbar — Board view keeps its
 * own inline "+ Add Status" affordance, but this is the one place custom statuses are removed
 * from (both surfaces read/write the same client_portal_ticket_custom_statuses table). */
export const TicketingConfigSection: React.FC = () => {
  const { t } = useTranslation('client-portal-settings');
  const { t: tTickets } = useTranslation('client-portal-tickets');
  const { t: tCommon } = useTranslation('client-portal-common');
  const { token } = theme.useToken();

  const [name, setName] = useState('');
  const [color, setColor] = useState(CLIENT_PORTAL_BRAND_COLORS[0]);

  const { data, isLoading } = useGetTicketCustomStatusesQuery();
  const [createStatus, { isLoading: isCreating }] = useCreateTicketCustomStatusMutation();
  const [deleteStatus] = useDeleteTicketCustomStatusMutation();

  const customStatuses = data?.body ?? [];

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.error(tTickets('customStatusNameRequired', { defaultValue: 'Enter a status name' }));
      return;
    }
    try {
      await createStatus({ name: trimmed, color }).unwrap();
      message.success(tTickets('customStatusAddedSuccess', { defaultValue: 'Custom status added' }));
      setName('');
      setColor(CLIENT_PORTAL_BRAND_COLORS[0]);
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(
        errorData?.message || tTickets('customStatusAddedError', { defaultValue: 'Failed to add custom status' })
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStatus(id).unwrap();
      message.success(tTickets('customStatusRemovedSuccess', { defaultValue: 'Custom status removed' }));
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(
        errorData?.message ||
          tTickets('customStatusRemovedError', { defaultValue: 'Failed to remove custom status' })
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard
        title={t('ticketingConfig.title', { defaultValue: 'Ticket Statuses' })}
        description={t('ticketingConfig.description', {
          defaultValue:
            "Open, In Progress and Resolved always exist and can't be removed. Add team-defined statuses for workflows specific to your team — they show up in both the List and Board views of Ticketing.",
        })}
      >
        <div style={{ marginBottom: 20 }}>
          <Typography.Text strong style={{ fontSize: 12.5 }}>
            {t('ticketingConfig.defaultStatusesLabel', { defaultValue: 'Default statuses' })}
          </Typography.Text>
          <Flex gap={8} wrap="wrap" style={{ marginTop: 8 }}>
            {TICKET_BUILT_IN_STATUSES.map(status => (
              <Tag key={status} color={ticketStatusColor(status)} style={{ margin: 0 }}>
                {tCommon(TICKET_BUILT_IN_STATUS_I18N[status].key, {
                  defaultValue: TICKET_BUILT_IN_STATUS_I18N[status].defaultValue,
                })}
              </Tag>
            ))}
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginTop: 6 }}>
            {t('ticketingConfig.defaultStatusesHint', {
              defaultValue: "These always exist and can't be removed.",
            })}
          </Typography.Text>
        </div>

        <Typography.Text strong style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}>
          {t('ticketingConfig.customStatusesLabel', { defaultValue: 'Custom statuses' })}
        </Typography.Text>

        <Flex gap={8} wrap="wrap" align="center" style={{ marginBottom: 20 }}>
          <Input
            size="small"
            value={name}
            maxLength={40}
            style={{ maxWidth: 260 }}
            placeholder={tTickets('customStatusNamePlaceholder', { defaultValue: 'e.g. Waiting on Client' })}
            onChange={event => setName(event.target.value)}
            onPressEnter={handleAdd}
          />

          <ColorPicker
            size="small"
            value={color}
            onChange={value => setColor(value.toHexString())}
            disabledAlpha
            presets={[
              {
                label: t('recommendedColorsLabel', { defaultValue: 'Recommended' }),
                colors: CLIENT_PORTAL_BRAND_COLORS,
              },
            ]}
          />

          <Button type="primary" size="small" onClick={handleAdd} loading={isCreating}>
            {tTickets('addCustomStatusButton', { defaultValue: 'Add Status' })}
          </Button>
        </Flex>

        {isLoading ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tTickets('loadingText', { defaultValue: 'Loading...' })}
          </Typography.Text>
        ) : customStatuses.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tTickets('noCustomStatusesYet', { defaultValue: 'No custom statuses yet.' })}
          </Typography.Text>
        ) : (
          <Flex vertical gap={0}>
            {customStatuses.map(status => (
              <Flex
                key={status.id}
                align="center"
                justify="space-between"
                style={{ padding: '8px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
              >
                <Tag color={status.color}>{status.name}</Tag>
                <Popconfirm
                  title={tTickets('removeCustomStatusConfirm', { defaultValue: 'Remove this custom status?' })}
                  okText={tTickets('deleteConfirmationOk', { defaultValue: 'Delete' })}
                  cancelText={tTickets('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
                  onConfirm={() => handleDelete(status.id)}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    aria-label={tTickets('removeCustomStatusLabel', {
                      name: status.name,
                      defaultValue: 'Remove {{name}}',
                    })}
                  />
                </Popconfirm>
              </Flex>
            ))}
          </Flex>
        )}
      </SectionCard>
    </div>
  );
};

export default TicketingConfigSection;
