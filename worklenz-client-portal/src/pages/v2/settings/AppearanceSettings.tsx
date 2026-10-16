import React from 'react';
import { Card, Radio, Typography, MoonOutlined, SunOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setTheme } from '@/store/slices/uiSlice';

/** Light or dark. The same value as the toggle in the avatar menu. */
const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const currentTheme = useAppSelector(state => state.ui.theme);

  return (
    <Card title={t('settings.nav.appearance', { defaultValue: 'Appearance' })}>
      <Typography.Paragraph type="secondary">
        {t('settings.appearance.help', { defaultValue: 'Choose how the portal looks on this device.' })}
      </Typography.Paragraph>
      <Radio.Group
        value={currentTheme}
        onChange={event => dispatch(setTheme(event.target.value))}
        aria-label={t('settings.nav.appearance', { defaultValue: 'Appearance' })}
        optionType="button"
        buttonStyle="solid"
        options={[
          { value: 'light', label: <span><SunOutlined aria-hidden /> {t('settings.appearance.light', { defaultValue: 'Light' })}</span> },
          { value: 'dark', label: <span><MoonOutlined aria-hidden /> {t('settings.appearance.dark', { defaultValue: 'Dark' })}</span> },
        ]}
      />
    </Card>
  );
};

export default AppearanceSettings;
