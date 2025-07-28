import React, { useState, useEffect } from 'react';
import {
  Modal,
  Checkbox,
  Button,
  Flex,
  Typography,
  Space,
  Divider,
  message,
} from '@/shared/antd-imports';
import { SettingOutlined, UpOutlined, DownOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

// Configuration interface for column visibility
interface ColumnConfig {
  key: string;
  label: string;
  showInDropdown: boolean;
  order: number;
  category?: string;
}

interface ColumnConfigurationModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  onSave: (config: ColumnConfig[]) => void;
  currentConfig: ColumnConfig[];
}

const ColumnConfigurationModal: React.FC<ColumnConfigurationModalProps> = ({
  open,
  onClose,
  projectId,
  onSave,
  currentConfig,
}) => {
  const { t } = useTranslation('task-list-filters');
  const [config, setConfig] = useState<ColumnConfig[]>(currentConfig);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setConfig(currentConfig);
    setHasChanges(false);
  }, [currentConfig, open]);

  const handleToggleColumn = (key: string) => {
    const newConfig = config.map(col =>
      col.key === key ? { ...col, showInDropdown: !col.showInDropdown } : col
    );
    setConfig(newConfig);
    setHasChanges(true);
  };

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    const currentIndex = config.findIndex(col => col.key === key);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= config.length) return;

    const newConfig = [...config];
    [newConfig[currentIndex], newConfig[newIndex]] = [newConfig[newIndex], newConfig[currentIndex]];

    // Update order numbers
    const updatedConfig = newConfig.map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    setConfig(updatedConfig);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(config);
    setHasChanges(false);
    message.success('Column configuration saved successfully');
    onClose();
  };

  const handleReset = () => {
    setConfig(currentConfig);
    setHasChanges(false);
  };

  const groupedColumns = config.reduce(
    (groups, column) => {
      const category = column.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(column);
      return groups;
    },
    {} as Record<string, ColumnConfig[]>
  );

  const categoryLabels: Record<string, string> = {
    basic: 'Basic Information',
    time: 'Time & Estimation',
    dates: 'Dates',
    other: 'Other',
  };

  return (
    <Modal
      title={
        <Flex align="center" gap={8}>
          <SettingOutlined />
          <span>Configure Show Fields Dropdown</span>
        </Flex>
      }
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="reset" onClick={handleReset} disabled={!hasChanges}>
          Reset
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} disabled={!hasChanges}>
          Save Configuration
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">
          Configure which columns appear in the "Show Fields" dropdown and their order. Use the
          up/down arrows to reorder columns.
        </Typography.Text>
      </div>

      {Object.entries(groupedColumns).map(([category, columns]) => (
        <div key={category}>
          <Divider orientation="left">
            <Typography.Text strong>{categoryLabels[category] || category}</Typography.Text>
          </Divider>

          {columns.map((column, index) => (
            <div
              key={column.key}
              style={{
                padding: '8px 12px',
                margin: '4px 0',
                border: '1px solid #f0f0f0',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#fafafa',
              }}
            >
              <Checkbox
                checked={column.showInDropdown}
                onChange={() => handleToggleColumn(column.key)}
                style={{ flex: 1 }}
              >
                <Typography.Text>{column.label}</Typography.Text>
              </Checkbox>

              <Typography.Text type="secondary" style={{ fontSize: '12px', minWidth: '60px' }}>
                Order: {column.order}
              </Typography.Text>

              <Space>
                <Button
                  size="small"
                  icon={<UpOutlined />}
                  onClick={() => moveColumn(column.key, 'up')}
                  disabled={index === 0}
                />
                <Button
                  size="small"
                  icon={<DownOutlined />}
                  onClick={() => moveColumn(column.key, 'down')}
                  disabled={index === columns.length - 1}
                />
              </Space>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
};

export default ColumnConfigurationModal;
