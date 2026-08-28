import { Badge, Tag, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface EnhancedClientPortalStatusTagsProps {
  status: string;
  showIcon?: boolean;
  size?: 'small' | 'default' | 'large';
}

const EnhancedClientPortalStatusTags: React.FC<EnhancedClientPortalStatusTagsProps> = ({
  status,
  showIcon = true,
  size = 'default',
}) => {
  const { t } = useTranslation('client-portal-common');

  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      // Request statuses
      case 'pending':
        return {
          color: 'warning',
          text: t('pending'),
          icon: '⏳',
          bgColor: '#fff7e6',
          borderColor: '#ffd591',
        };
      case 'accepted':
        return {
          color: 'processing',
          text: t('accepted'),
          icon: '✅',
          bgColor: '#e6f7ff',
          borderColor: '#91d5ff',
        };
      case 'in_progress':
        return {
          color: 'processing',
          text: t('inProgress'),
          icon: '🔄',
          bgColor: '#f0f9ff',
          borderColor: '#69c0ff',
        };
      case 'completed':
        return {
          color: 'success',
          text: t('completed'),
          icon: '✅',
          bgColor: '#f6ffed',
          borderColor: '#b7eb8f',
        };
      case 'rejected':
        return {
          color: 'error',
          text: t('rejected'),
          icon: '❌',
          bgColor: '#fff2f0',
          borderColor: '#ffccc7',
        };
      case 'cancelled':
        return {
          color: 'default',
          text: t('cancelled'),
          icon: '🚫',
          bgColor: '#f5f5f5',
          borderColor: '#d9d9d9',
        };

      // Invoice statuses
      case 'draft':
        return {
          color: 'default',
          text: t('draft'),
          icon: '📝',
          bgColor: '#fafafa',
          borderColor: '#d9d9d9',
        };
      case 'sent':
        return {
          color: 'processing',
          text: t('sent'),
          icon: '📤',
          bgColor: '#e6f7ff',
          borderColor: '#91d5ff',
        };
      case 'paid':
        return {
          color: 'success',
          text: t('paid'),
          icon: '💰',
          bgColor: '#f6ffed',
          borderColor: '#b7eb8f',
        };
      case 'overdue':
        return {
          color: 'error',
          text: t('overdue'),
          icon: '⚠️',
          bgColor: '#fff2f0',
          borderColor: '#ffccc7',
        };

      // Project statuses
      case 'active':
        return {
          color: 'processing',
          text: t('active'),
          icon: '🟢',
          bgColor: '#e6f7ff',
          borderColor: '#91d5ff',
        };
      case 'on_hold':
        return {
          color: 'warning',
          text: t('onHold'),
          icon: '⏸️',
          bgColor: '#fff7e6',
          borderColor: '#ffd591',
        };

      // Service statuses
      case 'available':
        return {
          color: 'success',
          text: t('available'),
          icon: '✅',
          bgColor: '#f6ffed',
          borderColor: '#b7eb8f',
        };
      case 'unavailable':
        return {
          color: 'default',
          text: t('unavailable'),
          icon: '❌',
          bgColor: '#f5f5f5',
          borderColor: '#d9d9d9',
        };
      case 'maintenance':
        return {
          color: 'warning',
          text: t('maintenance'),
          icon: '🔧',
          bgColor: '#fff7e6',
          borderColor: '#ffd591',
        };

      // Chat statuses
      case 'online':
        return {
          color: 'success',
          text: t('online'),
          icon: '🟢',
          bgColor: '#f6ffed',
          borderColor: '#b7eb8f',
        };
      case 'offline':
        return {
          color: 'default',
          text: t('offline'),
          icon: '⚫',
          bgColor: '#f5f5f5',
          borderColor: '#d9d9d9',
        };
      case 'away':
        return {
          color: 'warning',
          text: t('away'),
          icon: '🟡',
          bgColor: '#fff7e6',
          borderColor: '#ffd591',
        };
      case 'busy':
        return {
          color: 'error',
          text: t('busy'),
          icon: '🔴',
          bgColor: '#fff2f0',
          borderColor: '#ffccc7',
        };

      default:
        return {
          color: 'default',
          text: status,
          icon: '📌',
          bgColor: '#fafafa',
          borderColor: '#d9d9d9',
        };
    }
  };

  const { color, text, icon, bgColor, borderColor } = getStatusConfig(status);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          fontSize: '12px',
          padding: '2px 8px',
          lineHeight: '16px',
        };
      case 'large':
        return {
          fontSize: '14px',
          padding: '6px 12px',
          lineHeight: '22px',
        };
      default:
        return {
          fontSize: '13px',
          padding: '4px 10px',
          lineHeight: '20px',
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <Tag
      color={color}
      style={{
        ...sizeStyles,
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderRadius: '6px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: showIcon ? '4px' : '0',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
    >
      {showIcon && <span style={{ fontSize: '12px' }}>{icon}</span>}
      {text}
    </Tag>
  );
};

export default EnhancedClientPortalStatusTags;
