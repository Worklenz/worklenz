import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Flex, Spin, Empty, Input, Segmented } from 'antd';
import { SearchOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { portalApi, IDeliverable } from './portal-api';
import { usePortal } from './portal-context';
import StatusBadge from './StatusBadge';

const { Title, Text } = Typography;

type ViewMode = 'card' | 'list';
type FilterKey = 'all' | 'review' | 'approved' | 'in_progress' | 'done';

const FILTERS: { key: FilterKey; label: string; statuses: string[] }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'review', label: 'Awaiting Review', statuses: ['client_review'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['queued', 'in_progress', 'internal_review', 'revision'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'done', label: 'Done', statuses: ['done'] },
];

const PortalDeliverablesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = usePortal();
  const [deliverables, setDeliverables] = useState<IDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [view, setView] = useState<ViewMode>('card');

  useEffect(() => {
    if (!user) {
      navigate('/portal/login', { replace: true });
      return;
    }
    loadDeliverables();
  }, [user, navigate, loadDeliverables]);

  const loadDeliverables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalApi.getDeliverables();
      if (res.done && res.body) setDeliverables(res.body);
    } catch { /* handled */ }
    setLoading(false);
  }, []);

  const filtered = deliverables.filter((d) => {
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.type?.toLowerCase().includes(search.toLowerCase()) ||
      d.channel?.toLowerCase().includes(search.toLowerCase());

    const activeFilter = FILTERS.find((f) => f.key === filter);
    const matchesFilter = !activeFilter?.statuses.length || activeFilter.statuses.includes(d.status);

    return matchesSearch && matchesFilter;
  });

  const reviewCount = deliverables.filter((d) => d.status === 'client_review').length;

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 400 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Deliverables</Title>
          {reviewCount > 0 && (
            <Text type="secondary">
              {reviewCount} item{reviewCount !== 1 ? 's' : ''} awaiting your review
            </Text>
          )}
        </div>

        <Segmented
          value={view}
          onChange={(v) => setView(v as ViewMode)}
          options={[
            { value: 'card', icon: <AppstoreOutlined /> },
            { value: 'list', icon: <UnorderedListOutlined /> },
          ]}
          size="small"
        />
      </Flex>

      <Flex gap={12} style={{ marginBottom: 20 }} wrap="wrap">
        <Input
          placeholder="Search deliverables..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
          allowClear
        />
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
          options={FILTERS.map((f) => ({ value: f.key, label: f.label }))}
          size="middle"
        />
      </Flex>

      {filtered.length === 0 ? (
        <Empty description="No deliverables found" />
      ) : view === 'card' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((d) => (
            <DeliverableCard key={d.id} deliverable={d} onClick={() => navigate(`/portal/deliverables/${d.id}`)} />
          ))}
        </div>
      ) : (
        <Flex vertical gap={8}>
          {filtered.map((d) => (
            <DeliverableRow key={d.id} deliverable={d} onClick={() => navigate(`/portal/deliverables/${d.id}`)} />
          ))}
        </Flex>
      )}
    </div>
  );
};

// Card view item
const DeliverableCard: React.FC<{ deliverable: IDeliverable; onClick: () => void }> = ({ deliverable, onClick }) => {
  const d = deliverable;
  return (
    <Card
      hoverable
      onClick={onClick}
      style={{ borderRadius: 8 }}
      styles={{ body: { padding: 20 } }}
    >
      <Flex vertical gap={12}>
        <Flex justify="space-between" align="start">
          <Text strong style={{ fontSize: 15, flex: 1 }}>{d.title}</Text>
          <StatusBadge status={d.status} />
        </Flex>

        {d.description && (
          <Text
            type="secondary"
            style={{
              fontSize: 13,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {d.description}
          </Text>
        )}

        <Flex gap={16} wrap="wrap">
          {d.type && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {d.type}
            </Text>
          )}
          {d.channel && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {d.channel}
            </Text>
          )}
          {d.send_date && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Send: {new Date(d.send_date).toLocaleDateString()}
            </Text>
          )}
        </Flex>
      </Flex>
    </Card>
  );
};

// List view item
const DeliverableRow: React.FC<{ deliverable: IDeliverable; onClick: () => void }> = ({ deliverable, onClick }) => {
  const d = deliverable;
  return (
    <Card
      hoverable
      onClick={onClick}
      style={{ borderRadius: 6 }}
      styles={{ body: { padding: '12px 20px' } }}
    >
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={16} style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {d.title}
          </Text>
          {d.type && <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{d.type}</Text>}
          {d.channel && <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{d.channel}</Text>}
        </Flex>
        <Flex align="center" gap={12}>
          {d.send_date && (
            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              {new Date(d.send_date).toLocaleDateString()}
            </Text>
          )}
          <StatusBadge status={d.status} />
        </Flex>
      </Flex>
    </Card>
  );
};

export default PortalDeliverablesPage;
