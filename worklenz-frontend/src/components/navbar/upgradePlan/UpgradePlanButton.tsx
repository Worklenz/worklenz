import { Button, Tooltip } from '@/shared/antd-imports';
import React, { memo, useCallback } from 'react';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';

const UpgradePlanButton = memo(() => {
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
        onClick={useCallback(() => navigate('/worklenz/admin-center/billing'), [navigate])}
      >
        {t('upgradePlan')}
      </Button>
    </Tooltip>
  );
});

UpgradePlanButton.displayName = 'UpgradePlanButton';

export default UpgradePlanButton;
