import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Divider, Dropdown, Empty, Flex, Input, Space, theme } from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';

export interface FilterOption {
  id: string;
  name: string;
  color?: string | null;
}

interface TimeInStatusMultiSelectFilterProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

/** Filter chip with a searchable checkbox list, Select all and Clear (same behaviour as the Projects report chips). */
const TimeInStatusMultiSelectFilter = ({ label, options, selected, onChange, loading }: TimeInStatusMultiSelectFilterProps) => {
  const { t } = useTranslation('reporting-flow');
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState('');

  const visible = useMemo(
    () => options.filter(option => option.name.toLowerCase().includes(searchText.trim().toLowerCase())),
    [options, searchText]
  );
  const isAllSelected = options.length > 0 && selected.length === options.length;

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...selected, id] : selected.filter(item => item !== id));

  const content = (
    <div
      style={{
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: '8px 0',
        width: 260,
        maxHeight: 360,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '0 8px 4px' }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('tis.searchByName', { defaultValue: 'Search by name' })}
          aria-label={t('tis.searchByName', { defaultValue: 'Search by name' })}
          value={searchText}
          onChange={event => setSearchText(event.target.value)}
        />
      </div>
      <Space size="small" style={{ padding: '0 8px' }}>
        <Button type="link" size="small" disabled={isAllSelected} onClick={() => onChange(options.map(option => option.id))}>
          {t('tis.selectAll', { defaultValue: 'Select all' })}
        </Button>
        <Divider type="vertical" />
        <Button type="link" size="small" danger disabled={!selected.length} onClick={() => onChange([])}>
          {t('tis.clearAll', { defaultValue: 'Clear all' })}
        </Button>
      </Space>
      <Divider style={{ margin: '4px 0' }} />
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 8px' }}>
        {visible.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('tis.noMatches', { defaultValue: 'No matches' })} />
        ) : (
          visible.map(option => (
            <Flex key={option.id} align="center" style={{ padding: '4px 0' }}>
              <Checkbox checked={selected.includes(option.id)} onChange={event => toggle(option.id, event.target.checked)}>
                <Flex align="center" gap={8}>
                  {option.color && (
                    <span
                      aria-hidden
                      style={{ width: 8, height: 8, borderRadius: '50%', background: option.color, flexShrink: 0 }}
                    />
                  )}
                  {option.name}
                </Flex>
              </Checkbox>
            </Flex>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomLeft"
      popupRender={() => content}
      onOpenChange={open => {
        if (!open) setSearchText('');
      }}
    >
      <Button icon={<CaretDownFilled />} iconPosition="end" loading={loading}>
        {selected.length ? `${label} (${selected.length})` : label}
      </Button>
    </Dropdown>
  );
};

export default memo(TimeInStatusMultiSelectFilter);
