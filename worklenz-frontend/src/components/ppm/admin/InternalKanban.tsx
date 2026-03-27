// PPM-OVERRIDE: Phase 2 — Cross-client pipeline kanban view
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Flex, Spin, message, Select, Button, Badge, Tag, Empty, Input,
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import { adminApi, IPipelineItem } from './admin-api';

const { Title, Text } = Typography;

const PIPELINE_COLUMNS = [
  { key: 'incoming', label: 'Incoming', color: '#d9d9d9' },
  { key: 'queued', label: 'Queued', color: '#8c8c8c' },
  { key: 'in_progress', label: 'In Progress', color: '#1890ff' },
  { key: 'internal_review', label: 'Internal Review', color: '#722ed1' },
  { key: 'client_review', label: 'Client Review', color: '#fa8c16' },
  { key: 'revision', label: 'Revision', color: '#f5222d' },
  { key: 'approved', label: 'Approved', color: '#52c41a' },
];

const InternalKanban: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<IPipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPipeline(clientFilter ? { client_id: clientFilter } : undefined);
      if (res.done && res.body) setItems(res.body);
    } catch {
      message.error('Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [clientFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract unique clients for filter dropdown
  const clientOptions = Array.from(
    new Map(items.map(i => [i.client_id, i.client_name])).entries()
  ).map(([id, name]) => ({ value: id, label: name }));

  const filtered = items.filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/taskflow/ppm')} />
        <Title level={3} style={{ margin: 0 }}>Pipeline</Title>
      </Flex>

      <Flex gap={12} style={{ marginBottom: 20 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="All Clients"
          value={clientFilter}
          onChange={setClientFilter}
          allowClear
          options={clientOptions}
          style={{ width: 200 }}
        />
      </Flex>

      {loading ? (
        <Flex justify="center" align="center" style={{ minHeight: 300 }}><Spin size="large" /></Flex>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {PIPELINE_COLUMNS.map(col => {
            const colItems = filtered.filter(i => i.status === col.key);
            return (
              <div key={col.key} style={{ minWidth: 220, flex: 1 }}>
                <Flex align="center" gap={8} style={{ marginBottom: 10 }}>
                  <Badge color={col.color} />
                  <Text strong style={{ fontSize: 13 }}>{col.label}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>({colItems.length})</Text>
                </Flex>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {colItems.length === 0 ? (
                    <Card size="small" style={{ opacity: 0.4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Empty</Text>
                    </Card>
                  ) : (
                    colItems.map(item => (
                      <Card key={item.id} size="small" hoverable style={{ cursor: 'default' }}>
                        <Text strong style={{ fontSize: 13, display: 'block' }}>{item.title}</Text>
                        <Flex gap={4} style={{ marginTop: 4 }} wrap="wrap">
                          <Tag style={{ fontSize: 10, margin: 0 }} color="blue">{item.client_name}</Tag>
                          {item.assignee_name && (
                            <Tag style={{ fontSize: 10, margin: 0 }}>{item.assignee_name}</Tag>
                          )}
                          {item.priority && (
                            <Tag style={{ fontSize: 10, margin: 0 }}>{item.priority}</Tag>
                          )}
                        </Flex>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InternalKanban;
