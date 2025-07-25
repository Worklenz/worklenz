import { QuestionCircleOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import './HelpButton.css';

const HelpButton = memo(() => {
  // localization
  const { t } = useTranslation('navbar');

  return (
    <Tooltip title={t('help')}>
      <Button
        className="notification-icon"
        style={{ height: '62px', width: '60px' }}
        type="text"
        icon={<QuestionCircleOutlined style={{ fontSize: 20 }} />}
      />
    </Tooltip>
  );
});

HelpButton.displayName = 'HelpButton';

export default HelpButton;
