import { Tag } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../styles/colors';
import { themeWiseColor } from '../../utils/themeWiseColor';
import { useAppSelector } from '../../hooks/useAppSelector';

const ClientPortalStatusTags = ({
  status,
}: {
  status: 'pending' | 'inProgress' | 'accepted';
}) => {
  // localization
  const { t } = useTranslation('client-portal-common');

  // get theme data from theme reducer
  const themeMode = useAppSelector((state) => state.themeReducer.mode);

  // status-specific colors and text
  const statusConfig = {
    pending: {
      backgroundColor: themeWiseColor('#b0afaf', '#1e1e1e', themeMode),
      text: t('pendingStatus'),
    },
    inProgress: {
      backgroundColor: '#34c759',
      text: t('inProgressStatus'),
    },
    accepted: {
      backgroundColor: '#34c759',
      text: t('acceptedStatus'),
    },
  };

  // default to 'pending' if status is unknown
  const { backgroundColor, text } =
    statusConfig[status] || statusConfig.pending;

  return (
    <Tag
      style={{
        width: 'fit-content',
        borderRadius: 24,
        paddingInline: 8,
        height: 22,
        color: colors.white,
        border: 'none',
        backgroundColor,
      }}
    >
      {text}
    </Tag>
  );
};

export default ClientPortalStatusTags;
