import { Tag } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ClientPortalStatusTagsProps {
  status: string;
}

const ClientPortalStatusTags: React.FC<ClientPortalStatusTagsProps> = ({ 
  status 
}) => {
  const { t } = useTranslation('client-portal-common');

  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      // Request statuses
      case 'pending':
        return { color: 'orange', text: t('pending') };
      case 'accepted':
        return { color: 'blue', text: t('accepted') };
      case 'in_progress':
        return { color: 'processing', text: t('inProgress') };
      case 'completed':
        return { color: 'success', text: t('completed') };
      case 'rejected':
        return { color: 'error', text: t('rejected') };
      case 'cancelled':
        return { color: 'default', text: t('cancelled') };

      // Invoice statuses
      case 'draft':
        return { color: 'default', text: t('draft') };
      case 'sent':
        return { color: 'processing', text: t('sent') };
      case 'paid':
        return { color: 'success', text: t('paid') };
      case 'overdue':
        return { color: 'error', text: t('overdue') };

      // Project statuses
      case 'active':
        return { color: 'blue', text: t('active') };
      case 'on_hold':
        return { color: 'orange', text: t('onHold') };

      // Service statuses
      case 'available':
        return { color: 'success', text: t('available') };
      case 'unavailable':
        return { color: 'default', text: t('unavailable') };
      case 'maintenance':
        return { color: 'warning', text: t('maintenance') };

      // Chat statuses
      case 'online':
        return { color: 'success', text: t('online') };
      case 'offline':
        return { color: 'default', text: t('offline') };
      case 'away':
        return { color: 'warning', text: t('away') };
      case 'busy':
        return { color: 'error', text: t('busy') };

      default:
        return { color: 'default', text: status };
    }
  };

  const { color, text } = getStatusConfig(status);

  return (
    <Tag color={color}>
      {text}
    </Tag>
  );
};

export default ClientPortalStatusTags;
