import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Checkbox, FilterOutlined, Flex, Popover, Typography } from '@/shared/antd-imports';

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

interface FilterButtonProps {
  groups: FilterGroup[];
  onClear: () => void;
}

/** The toolbar Filter button: a popover of checkbox groups, with the number of active filters on the button. */
export const FilterButton = ({ groups, onClear }: FilterButtonProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = groups.filter(group => group.value.length > 0).length;
  const isHighlighted = isOpen || activeCount > 0;

  const panel = (
    <div style={{ width: 'min(300px, calc(100vw - 64px))' }}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
        <Typography.Text strong>{t('toolbar.filters', { defaultValue: 'Filters' })}</Typography.Text>
        {activeCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={onClear}>
            {t('toolbar.clear', { defaultValue: 'Clear' })}
          </Button>
        )}
      </Flex>
      <Flex vertical gap={12}>
        {groups.map(group => (
          <div key={group.key}>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              {group.label}
            </Typography.Text>
            {group.options.length === 0 ? (
              <Typography.Text type="secondary">{t('toolbar.noOptions', { defaultValue: 'Nothing to filter by' })}</Typography.Text>
            ) : (
              <Checkbox.Group
                aria-label={group.label}
                value={group.value}
                options={group.options}
                onChange={values => group.onChange(values as string[])}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              />
            )}
          </div>
        ))}
      </Flex>
    </div>
  );

  return (
    <Popover content={panel} trigger="click" placement="bottomRight" open={isOpen} onOpenChange={setIsOpen}>
      <Button icon={<FilterOutlined />} type={isHighlighted ? 'primary' : 'default'} ghost={isHighlighted}>
        {t('toolbar.filter', { defaultValue: 'Filter' })}
        {activeCount > 0 && <Badge count={activeCount} size="small" style={{ marginInlineStart: 4 }} />}
      </Button>
    </Popover>
  );
};
