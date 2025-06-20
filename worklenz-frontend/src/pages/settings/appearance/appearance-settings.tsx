import { Card, Divider, Flex, Switch, Typography } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { useAppSelector } from '@/hooks/use-app-selector';
import { toggleTheme } from '@/features/theme/theme.slice';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useDocumentTitle } from '@/hooks/use-document-titlee';

const AppearanceSettings = () => {
  const { t } = useTranslation('settings/appearance');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  useDocumentTitle(t('title'));

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  return (
    <Card style={{ width: '100%' }}>
      <Flex vertical gap={4}>
        <Flex gap={8} align="center">
          <Switch
            checked={themeMode === 'dark'}
            onChange={handleThemeToggle}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
          />
          <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
            {t('darkMode')}
          </Typography.Title>
        </Flex>
        <Typography.Text
          style={{ fontSize: 14, color: themeMode === 'dark' ? '#9CA3AF' : '#00000073' }}
        >
          {t('darkModeDescription')}
        </Typography.Text>
      </Flex>
    </Card>
  );
};

export default AppearanceSettings; 