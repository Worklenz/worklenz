import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Typography,
  Table,
  Tag,
  Spin,
  Alert,
  Empty,
} from "@/shared/antd-imports";
import { FileDoneOutlined } from "@/shared/antd-imports";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import clientPortalAPI from "@/services/api";
import { ClientInvoice } from "@/types";
import type { TableProps } from "antd/lib";

const { Title, Text } = Typography;

const InvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalInvoices, setTotalInvoices] = useState(0);

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await clientPortalAPI.getInvoices({});

      if (response.done) {
        const data = response.body as any;
        setInvoices(data.invoices || []);
        setTotalInvoices(data.total || 0);
      } else {
        setError(t('invoices.errorLoading'));
      }
    } catch (err) {
      setError(t('invoices.errorLoadingDescription'));
      console.error("Invoices API error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "success";
      case "pending":
        return "warning";
      case "overdue":
        return "error";
      case "cancelled":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return t('invoices.paid');
      case "pending":
        return t('invoices.pending');
      case "overdue":
        return t('invoices.overdue');
      case "cancelled":
        return t('invoices.cancelled');
      default:
        return status;
    }
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 4 }}>
            <FileDoneOutlined style={{ marginRight: 8 }} />
            {t('invoices.title')}
          </Title>
          <Text type="secondary">{t('invoices.description')}</Text>
        </div>
        <Alert message={t('invoices.errorLoading')} description={error} type="error" showIcon />
      </div>
    );
  }

  // Handle empty state
  if (!invoices || invoices.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            <FileDoneOutlined style={{ marginRight: 8 }} />
            {t('invoices.title')}
          </Title>
          <Text type="secondary">{t('invoices.description')}</Text>
        </div>
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('invoices.noInvoicesYet')}
          />
        </Card>
      </div>
    );
  }

  const columns: TableProps["columns"] = [
    {
      key: "invoiceNumber",
      title: t('invoices.invoiceNo'),
      render: (record) => <Text strong>{record.invoiceNumber}</Text>,
      onCell: () => ({
        style: { minWidth: 140 },
      }),
    },
    {
      key: "serviceName",
      title: t('invoices.service'),
      render: (record) => <Text>{record.serviceName || "-"}</Text>,
      onCell: () => ({
        style: { minWidth: 200 },
      }),
    },
    {
      key: "amount",
      title: t('invoices.amount'),
      render: (record) => (
        <Text strong>
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: record.currency || "USD",
          }).format(record.amount)}
        </Text>
      ),
      onCell: () => ({
        style: { minWidth: 130 },
      }),
    },
    {
      key: "status",
      title: t('invoices.status'),
      render: (record) => (
        <Tag color={getStatusColor(record.status)}>{getStatusText(record.status)}</Tag>
      ),
      width: 120,
    },
    {
      key: "dueDate",
      title: t('invoices.dueDate'),
      render: (record) => (
        <Text>
          {record.dueDate ? new Date(record.dueDate).toLocaleDateString() : "-"}
        </Text>
      ),
      width: 150,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          <FileDoneOutlined style={{ marginRight: 8 }} />
          {t('invoices.title')}
        </Title>
        <Text type="secondary">{t('invoices.description')}</Text>
      </div>

      {/* Invoices Table */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={invoices}
          rowKey="id"
          size="small"
          pagination={{
            size: "small",
            total: totalInvoices,
            showSizeChanger: true,
          }}
          scroll={{ x: "max-content" }}
          onRow={(record) => ({
            onClick: () => navigate(`/invoices/${record.id}`),
            style: { cursor: "pointer" },
          })}
        />
      </Card>
    </div>
  );
};

export default InvoicesPage;
