import React, { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Flex,
  Table,
  Tag,
  Spin,
  Alert,
  Empty,
  FileTextOutlined,
} from "@/shared/antd-imports";
import { useNavigate } from "react-router-dom";
import clientPortalAPI from "@/services/api";
import { ClientInvoice } from "@/types";
import type { TableProps } from "antd/lib";

const { Title, Text } = Typography;

const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalInvoices, setTotalInvoices] = useState(0);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await clientPortalAPI.getInvoices({});

      if (response.done) {
        const data = response.body as any;
        setInvoices(data.invoices || []);
        setTotalInvoices(data.total || 0);
      } else {
        setError("Failed to load invoices");
      }
    } catch (err) {
      setError("Failed to load invoices. Please try again later.");
      console.error("Invoices API error:", err);
    } finally {
      setIsLoading(false);
    }
  };

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
        return "Paid";
      case "pending":
        return "Pending";
      case "overdue":
        return "Overdue";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div
        style={{
          maxWidth: "100%",
          minHeight: "calc(100vh - 120px)",
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
            <FileTextOutlined style={{ fontSize: 20 }} />
            <Title level={4} style={{ margin: 0, fontSize: "20px" }}>
              Invoices
            </Title>
          </Flex>
          <Text type="secondary" style={{ fontSize: "16px", lineHeight: 1.5 }}>
            View and manage your invoices and payments
          </Text>
        </div>
        <Card style={{ height: "calc(100vh - 280px)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "200px",
            }}
          >
            <Spin size="large" />
          </div>
        </Card>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div
        style={{
          maxWidth: "100%",
          minHeight: "calc(100vh - 120px)",
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
            <FileTextOutlined style={{ fontSize: 20 }} />
            <Title level={4} style={{ margin: 0, fontSize: "20px" }}>
              Invoices
            </Title>
          </Flex>
          <Text type="secondary" style={{ fontSize: "16px", lineHeight: 1.5 }}>
            View and manage your invoices and payments
          </Text>
        </div>
        <Card style={{ height: "calc(100vh - 280px)" }}>
          <Alert message="Error loading invoices" description={error} type="error" showIcon />
        </Card>
      </div>
    );
  }

  // Handle empty state
  if (!invoices || invoices.length === 0) {
    return (
      <div
        style={{
          maxWidth: "100%",
          minHeight: "calc(100vh - 120px)",
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
            <FileTextOutlined style={{ fontSize: 20 }} />
            <Title level={4} style={{ margin: 0, fontSize: "20px" }}>
              Invoices
            </Title>
          </Flex>
          <Text type="secondary" style={{ fontSize: "16px", lineHeight: 1.5 }}>
            View and manage your invoices and payments
          </Text>
        </div>
        <Card style={{ height: "calc(100vh - 280px)" }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Title level={4} style={{ marginBottom: 8 }}>
                  No invoices yet
                </Title>
                <Text type="secondary">Your invoices will appear here when available</Text>
              </div>
            }
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "calc(100vh - 320px)",
            }}
          />
        </Card>
      </div>
    );
  }

  const columns: TableProps["columns"] = [
    {
      key: "invoiceNumber",
      title: "Invoice #",
      render: (record) => <Text strong>{record.invoiceNumber}</Text>,
      onCell: () => ({
        style: { minWidth: 140 },
      }),
    },
    {
      key: "serviceName",
      title: "Service",
      render: (record) => <Text>{record.serviceName || "-"}</Text>,
      onCell: () => ({
        style: { minWidth: 200 },
      }),
    },
    {
      key: "amount",
      title: "Amount",
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
      title: "Status",
      render: (record) => (
        <Tag color={getStatusColor(record.status)}>{getStatusText(record.status)}</Tag>
      ),
      width: 120,
    },
    {
      key: "dueDate",
      title: "Due Date",
      render: (record) => (
        <Text>
          {record.dueDate ? new Date(record.dueDate).toLocaleDateString() : "-"}
        </Text>
      ),
      width: 150,
    },
  ];

  return (
    <div
      style={{
        maxWidth: "100%",
        minHeight: "calc(100vh - 120px)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
          <FileTextOutlined style={{ fontSize: 20 }} />
          <Title level={4} style={{ margin: 0, fontSize: "20px" }}>
            Invoices
          </Title>
        </Flex>
        <Text type="secondary" style={{ fontSize: "16px", lineHeight: 1.5 }}>
          View and manage your invoices and payments
        </Text>
      </div>

      {/* Invoices Table */}
      <Card
        style={{
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          borderRadius: 8,
        }}
      >
        <Table
          columns={columns}
          dataSource={invoices}
          rowKey="id"
          pagination={{
            size: "small",
            total: totalInvoices,
            current: 1,
            pageSize: 10,
          }}
          scroll={{
            x: "max-content",
          }}
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
