import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterOutlined } from '@ant-design/icons';
import { Badge, Button, Flex, Popover, Typography } from '@/shared/antd-imports';
import { FilterChip } from './FilterChip';
import { PORTAL_TOOLBAR_BUTTON_STYLE } from './toolbar-style';

export interface PortalFilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Adds a search box above the options, for long lists such as clients. */
  searchPlaceholder?: string;
}

interface PortalFilterButtonProps {
  groups: PortalFilterGroup[];
  onClear: () => void;
  /** Extra filter content (such as a date range) shown under the chips, and whether it is active. */
  extra?: ReactNode;
  isExtraActive?: boolean;
}

/** The Filter button every v2 list shares: a popover of multi-select chips with the number of active filters on the button. */
export const PortalFilterButton = ({ groups, onClear, extra, isExtraActive = false }: PortalFilterButtonProps) => {
  const { t } = useTranslation('client-portal-v2');
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = groups.filter(group => group.value.length > 0).length + (isExtraActive ? 1 : 0);
  const isHighlighted = isOpen || activeCount > 0;

  const panel = (
    <div style={{ width: 'min(360px, calc(100vw - 32px))', padding: '4px 0' }}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 12 }}>
        <Typography.Text strong style={{ fontSize: 14 }}>
          {t('toolbarFilterTitle', { defaultValue: 'Filters' })}
        </Typography.Text>
        {activeCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={onClear}>
            {t('toolbarClear', { defaultValue: 'Clear' })}
          </Button>
        )}
      </Flex>
      <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
        {t('toolbarQuickFilters', { defaultValue: 'Quick filters' })}
      </Typography.Text>
      <Flex gap={8} wrap="wrap" align="center">
        {groups.map(group => (
          <FilterChip
            key={group.key}
            label={group.label}
            options={group.options}
            value={group.value}
            onChange={group.onChange}
            selectAllLabel={t('toolbarSelectAll', { defaultValue: 'Select All' })}
            clearLabel={t('toolbarClearAll', { defaultValue: 'Clear All' })}
            searchPlaceholder={group.searchPlaceholder}
          />
        ))}
      </Flex>
      {extra}
    </div>
  );

  return (
    <Popover
      content={panel}
      trigger="click"
      placement="bottomRight"
      open={isOpen}
      onOpenChange={setIsOpen}
      overlayInnerStyle={{ padding: '12px 16px', borderRadius: 8 }}
    >
      <Button
        icon={<FilterOutlined />}
        style={PORTAL_TOOLBAR_BUTTON_STYLE}
        type={isHighlighted ? 'primary' : 'default'}
        ghost={isHighlighted}
      >
        {t('toolbarFilter', { defaultValue: 'Filter' })}
        {activeCount > 0 && <Badge count={activeCount} size="small" style={{ marginLeft: 4 }} />}
      </Button>
    </Popover>
  );
};
