import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Popconfirm, Tag, Typography, message } from '@/shared/antd-imports';
import { DeleteOutlined, CreditCardOutlined } from '@/shared/antd-imports';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import logger from '@/utils/errorLogger';

interface IDirectPayCard {
  card_id: number;
  mask: string;
  brand: string;
  type: string;
  issuer: string;
  expiry: string;
  created_at: string;
}

const SavedCards: React.FC = () => {
  const [cards, setCards] = useState<IDirectPayCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const res = await billingApiService.listCards();
      if (res.done && res.body) {
        setCards(res.body.card_list ?? []);
      }
    } catch (error) {
      logger.error('Failed to load saved cards', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleDelete = async (cardId: number) => {
    try {
      setDeletingId(cardId);
      const res = await billingApiService.deleteCard(String(cardId));
      if (res.done) {
        message.success('Card removed successfully');
        setCards(prev => prev.filter(c => c.card_id !== cardId));
      } else {
        message.error(res.message || 'Failed to remove card');
      }
    } catch (error) {
      logger.error('Failed to delete card', error);
      message.error('Failed to remove card');
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      title: 'Card',
      key: 'card',
      render: (_: any, record: IDirectPayCard) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CreditCardOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <div>
            <Typography.Text strong>{record.mask}</Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {record.brand} · {record.type}
                {record.issuer && record.issuer !== '-' ? ` · ${record.issuer}` : ''}
              </Typography.Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Expires',
      dataIndex: 'expiry',
      key: 'expiry',
      width: 100,
      render: (expiry: string) => (
        <Typography.Text type="secondary">{expiry}</Typography.Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'CREDIT' ? 'blue' : 'green'}>{type}</Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, record: IDirectPayCard) => (
        <Popconfirm
          title="Remove this card?"
          description="This card will be permanently removed."
          onConfirm={() => handleDelete(record.card_id)}
          okText="Remove"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            loading={deletingId === record.card_id}
            size="small"
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title={
        <Typography.Text strong style={{ fontSize: 16 }}>
          Saved Payment Methods
        </Typography.Text>
      }
      style={{ marginTop: 16 }}
    >
      <Table
        dataSource={cards}
        columns={columns}
        rowKey="card_id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'No saved cards' }}
        size="small"
      />
    </Card>
  );
};

export default SavedCards;
