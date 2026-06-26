import { Button, Tooltip } from '@/shared/antd-imports';
import React from 'react';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';

const UpgradePlanButton = () => {
  // localization
  const { t } = useTranslation('navbar');
  const navigate = useNavigate();

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <Tooltip title={t('upgradePlanTooltip')}>
      <Button
        style={{
          backgroundColor: themeMode === 'dark' ? '#b38750' : colors.lightBeige,
          color: '#000000d9',
          padding: '4px 11px',
        }}
        size="small"
        type="text"
        onClick={() => navigate('/worklenz/admin-center/billing')}
      >
        {t('upgradePlan')}
      </Button>
    </Tooltip>
  );
};

export default UpgradePlanButton;
