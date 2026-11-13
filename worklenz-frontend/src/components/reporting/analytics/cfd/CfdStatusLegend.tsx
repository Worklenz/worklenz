import React from 'react';
import { Button, Checkbox, Flex, InputNumber, Space, Typography, theme } from '@/shared/antd-imports';
import { HolderOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { CfdStatusMeta } from '@/types/reporting/analytics-cfd.types';

const { Text } = Typography;

export interface CfdLegendItem {
  status: CfdStatusMeta;
  visible: boolean;
  threshold?: number;
}

interface CfdStatusLegendProps {
  items: CfdLegendItem[];
  onToggle: (statusId: string, visible: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onThresholdChange: (statusId: string, value: number | null) => void;
}

export const CfdStatusLegend: React.FC<CfdStatusLegendProps> = ({
  items,
  onToggle,
  onReorder,
  onThresholdChange,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  return (
    <Flex vertical gap={8} style={{ minWidth: 260, maxWidth: 320 }}>
      <Text strong style={{ fontSize: 13 }}>
        {t('cfdStatusesLegend', { defaultValue: 'Statuses' })}
      </Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('cfdStatusesLegendHint', {
          defaultValue: 'Toggle visibility, drag to reorder, set WIP limits.',
        })}
      </Text>
      <Flex
        vertical
        gap={8}
        style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}
      >
      {items.map((item, index) => (
        <Flex
          key={item.status.id}
          align="center"
          gap={8}
          style={{
            padding: '6px 8px',
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            opacity: item.visible ? 1 : 0.55,
          }}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => {
            if (dragIndex === null || dragIndex === index) return;
            onReorder(dragIndex, index);
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
        >
          <Button
            type="text"
            size="small"
            icon={<HolderOutlined />}
            aria-label={t('cfdReorderStatus', { defaultValue: 'Reorder status' })}
            style={{ cursor: 'grab', color: token.colorTextSecondary }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: item.status.color || token.colorPrimary,
              flexShrink: 0,
            }}
          />
          <Checkbox
            checked={item.visible}
            onChange={e => onToggle(item.status.id, e.target.checked)}
            style={{ flex: 1, marginInlineEnd: 0 }}
          >
            <Text ellipsis style={{ maxWidth: 110 }}>
              {item.status.name}
            </Text>
          </Checkbox>
          <Space size={4} align="center">
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {t('cfdWipLimit', { defaultValue: 'WIP' })}
            </Text>
            <InputNumber
              size="small"
              min={0}
              value={item.threshold}
              placeholder="—"
              style={{ width: 64 }}
              onChange={val =>
                onThresholdChange(item.status.id, typeof val === 'number' ? val : null)
              }
              aria-label={t('cfdWipThresholdFor', {
                defaultValue: 'WIP threshold for {{name}}',
                name: item.status.name,
              })}
            />
          </Space>
        </Flex>
      ))}
      </Flex>
    </Flex>
  );
};
