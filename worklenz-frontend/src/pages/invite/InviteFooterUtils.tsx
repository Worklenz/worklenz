import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, MenuProps, theme } from '@/shared/antd-imports';
import { GlobalOutlined, MoonOutlined, SunOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setLanguage, ILanguageType, Language } from '@/features/i18n/localesSlice';
import { toggleTheme } from '@/features/theme/themeSlice';
import { timezonesApiService } from '@/api/settings/language-timezones/language-timezones-api.service';
import logger from '@/utils/errorLogger';

const languages = [
  { key: Language.EN, label: 'English', flag: '🇺🇸' },
  { key: Language.ES, label: 'Español', flag: '🇪🇸' },
  { key: Language.PT, label: 'Português', flag: '🇵🇹' },
  { key: Language.DE, label: 'Deutsch', flag: '🇩🇪' },
  { key: Language.ALB, label: 'Shqip', flag: '🇦🇱' },
  { key: Language.ZH, label: '简体中文', flag: '🇨🇳' },
];

interface InviteFooterUtilsProps {
  isDarkMode: boolean;
  userTimezone?: string;
  isAuthenticated?: boolean;
}

// Theme + language switcher pinned to the invite footer's bottom-right corner,
// mirroring the same control in the account-setup wizard footer so invitation
// and onboarding feel like one continuous flow.
const InviteFooterUtils: React.FC<InviteFooterUtilsProps> = ({
  isDarkMode,
  userTimezone,
  isAuthenticated,
}) => {
  const { t, i18n } = useTranslation('invitation');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const lng = useAppSelector(state => state.localesReducer.lng);

  const handleLanguageChange = (languageKey: ILanguageType) => {
    dispatch(setLanguage(languageKey));
    i18n.changeLanguage(languageKey);

    // Persist to the backend (mirrors Settings > Language and Region) so the
    // choice survives past this page - only possible when the visitor is
    // already logged in. userTimezone may still be undefined for a logged-in,
    // brand-new user; the backend preserves their existing timezone_id (if
    // any) when it isn't provided instead of nulling it out.
    if (isAuthenticated) {
      timezonesApiService
        .update({ language: languageKey, timezone: userTimezone })
        .catch(error => logger.error('Failed to save language preference', error));
    }
  };

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  const languageMenuItems: MenuProps['items'] = languages.map(lang => ({
    key: lang.key,
    label: (
      <div className="flex items-center space-x-2">
        <span>{lang.flag}</span>
        <span>{lang.label}</span>
      </div>
    ),
    onClick: () => handleLanguageChange(lang.key as ILanguageType),
  }));

  const currentLanguage = languages.find(lang => lang.key === lng) || languages[0];

  return (
    <div className="invite-footer-utils">
      <Button
        type="text"
        size="small"
        icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
        onClick={handleThemeToggle}
        className="flex items-center"
        style={{ color: token?.colorTextTertiary }}
        title={isDarkMode ? t('switchToLightMode') : t('switchToDarkMode')}
      />
      <Dropdown menu={{ items: languageMenuItems }} placement="topRight" trigger={['click']}>
        <Button
          type="text"
          size="small"
          icon={<GlobalOutlined />}
          className="flex items-center space-x-2"
          style={{ color: token?.colorTextTertiary }}
        >
          <span>{currentLanguage.flag}</span>
          <span className="hidden sm:inline">{currentLanguage.label}</span>
        </Button>
      </Dropdown>
    </div>
  );
};

export default InviteFooterUtils;
