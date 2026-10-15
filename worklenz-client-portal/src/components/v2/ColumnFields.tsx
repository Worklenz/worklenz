import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Checkbox, Dropdown, EyeOutlined, Flex, Tooltip, Typography, theme } from '@/shared/antd-imports';

export interface ColumnField {
  /** The table column `key` this field shows or hides. */
  key: string;
  label: string;
}

interface FieldsButtonProps {
  fields: ColumnField[];
  hidden: string[];
  onToggle: (key: string) => void;
}

/** The eye "Fields" button: a checkbox list of the table's optional columns. */
export const FieldsButton = ({ fields, hidden, onToggle }: FieldsButtonProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [isOpen, setIsOpen] = useState(false);
  const title = t('toolbar.showFields', { defaultValue: 'Show fields' });

  const content = (
    <Card styles={{ body: { padding: '8px 4px', minWidth: 220 } }} style={{ boxShadow: token.boxShadowSecondary }}>
      <Typography.Text
        type="secondary"
        style={{ display: 'block', padding: '4px 12px 8px', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}
      >
        {title}
      </Typography.Text>
      <Flex vertical role="group" aria-label={title}>
        {fields.map(field => (
          <Checkbox
            key={field.key}
            checked={!hidden.includes(field.key)}
            onChange={() => onToggle(field.key)}
            style={{ padding: '6px 12px', margin: 0, fontWeight: 600 }}
          >
            {field.label}
          </Checkbox>
        ))}
      </Flex>
    </Card>
  );

  return (
    <Dropdown dropdownRender={() => content} trigger={['click']} placement="bottomRight" open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip title={title}>
        <Button
          icon={<EyeOutlined />}
          type={isOpen ? 'primary' : 'default'}
          ghost={isOpen}
          aria-label={t('toolbar.fields', { defaultValue: 'Fields' })}
        />
      </Tooltip>
    </Dropdown>
  );
};
