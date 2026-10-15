import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Button, Card, Checkbox, Dropdown, Flex, Tooltip, Typography, theme } from '@/shared/antd-imports';
import { PORTAL_TOOLBAR_BUTTON_STYLE } from './toolbar-style';

export interface PortalField {
  /** The table column `key` this field shows or hides. */
  key: string;
  label: string;
}

const readHidden = (storageKey: string): string[] => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Which optional columns a list hides. The choice is remembered per browser only; the page still works
 * when storage is unavailable.
 */
export const usePortalColumnVisibility = (storageKey: string) => {
  const [hidden, setHidden] = useState<string[]>(() => readHidden(storageKey));

  const toggle = useCallback(
    (key: string) =>
      setHidden(previous => {
        const next = previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key];
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Storage can be blocked; the choice then lasts until the page closes.
        }
        return next;
      }),
    [storageKey]
  );

  const visibleColumns = useCallback(
    <T extends object>(columns: ColumnsType<T>): ColumnsType<T> =>
      columns.filter(column => !(column.key !== undefined && hidden.includes(String(column.key)))),
    [hidden]
  );

  return { hidden, toggle, visibleColumns };
};

interface PortalFieldsButtonProps {
  fields: PortalField[];
  hidden: string[];
  onToggle: (key: string) => void;
}

/** The eye "Fields" button: a checkbox list of the table's optional columns. */
export const PortalFieldsButton = ({ fields, hidden, onToggle }: PortalFieldsButtonProps) => {
  const { t } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const [isOpen, setIsOpen] = useState(false);

  const content = (
    <Card className="custom-card" styles={{ body: { padding: '8px 4px', minWidth: 220 } }}>
      <Typography.Text
        type="secondary"
        style={{ display: 'block', padding: '4px 12px 8px', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}
      >
        {t('toolbarShowFields', { defaultValue: 'Show fields' })}
      </Typography.Text>
      <Flex vertical role="group" aria-label={t('toolbarShowFields', { defaultValue: 'Show fields' })}>
        {fields.map(field => (
          <Checkbox
            key={field.key}
            checked={!hidden.includes(field.key)}
            onChange={() => onToggle(field.key)}
            style={{ padding: '6px 12px', margin: 0, fontWeight: 600, color: token.colorText }}
          >
            {field.label}
          </Checkbox>
        ))}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => content}
      trigger={['click']}
      placement="bottomRight"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <Tooltip title={t('toolbarShowFields', { defaultValue: 'Show fields' })}>
        <Button
          icon={<EyeOutlined />}
          style={PORTAL_TOOLBAR_BUTTON_STYLE}
          type={isOpen ? 'primary' : 'default'}
          ghost={isOpen}
          aria-label={t('toolbarFields', { defaultValue: 'Fields' })}
        />
      </Tooltip>
    </Dropdown>
  );
};
