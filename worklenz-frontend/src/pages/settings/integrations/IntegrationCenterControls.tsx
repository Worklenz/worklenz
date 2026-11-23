import { Input, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

interface IntegrationCenterControlsProps {
  hideTitle: boolean;
}

export function IntegrationCenterControls({ hideTitle }: IntegrationCenterControlsProps) {
  const { t } = useTranslation('settings/integrations');
  if (hideTitle) return null;
  return (
    <Typography.Title level={4} style={{ margin: 0 }}>
      {t('center.title', { defaultValue: 'Integration Center' })}
    </Typography.Title>
  );
}

interface IntegrationCenterSearchProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export function IntegrationCenterSearch({
  searchQuery,
  setSearchQuery,
}: IntegrationCenterSearchProps) {
  const { t } = useTranslation('settings/integrations');
  return (
    <div className="flex flex-wrap gap-3">
      <Input.Search
        className="flex-1 min-w-[200px]"
        value={searchQuery}
        onChange={event => setSearchQuery(event.target.value)}
        placeholder={t('center.searchPlaceholder', { defaultValue: 'Search integrations' })}
        aria-label={t('center.searchLabel', { defaultValue: 'Search integrations' })}
        allowClear
      />
    </div>
  );
}
