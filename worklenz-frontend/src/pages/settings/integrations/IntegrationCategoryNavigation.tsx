import { AppstoreOutlined, CodeOutlined, ImportOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';

interface IntegrationCategoryNavigationProps {
  category: string;
  onChange: (category: string) => void;
}

export function IntegrationCategoryNavigation({
  category,
  onChange,
}: IntegrationCategoryNavigationProps) {
  const { t } = useTranslation('settings/integrations');
  const { token } = theme.useToken();
  const categories = [
    {
      value: 'all',
      label: t('center.allCategories', { defaultValue: 'All categories' }),
      icon: <AppstoreOutlined aria-hidden="true" />,
    },
    {
      value: 'messaging',
      label: t('center.messaging', { defaultValue: 'Communication' }),
      icon: <MessageOutlined aria-hidden="true" />,
    },
    {
      value: 'issue-tracking',
      label: t('center.development', { defaultValue: 'Development' }),
      icon: <CodeOutlined aria-hidden="true" />,
    },
    {
      value: 'import',
      label: t('center.imports', { defaultValue: 'Imports' }),
      icon: <ImportOutlined aria-hidden="true" />,
    },
  ];
  return (
    <nav
      aria-label={t('center.categoryLabel', { defaultValue: 'Integration category' })}
      className="lg:w-48 lg:shrink-0"
    >
      <Typography.Text type="secondary" className="hidden lg:block mb-2 px-3">
        {t('center.categoryLabel', { defaultValue: 'Integration category' })}
      </Typography.Text>
      <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {categories.map(item => (
          <Button
            key={item.value}
            type="text"
            icon={item.icon}
            aria-pressed={category === item.value}
            onClick={() => onChange(item.value)}
            className="shrink-0 lg:w-full lg:text-left"
            style={{
              justifyContent: 'flex-start',
              background: category === item.value ? token.colorPrimaryBg : undefined,
              color: category === item.value ? token.colorPrimary : undefined,
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </nav>
  );
}
