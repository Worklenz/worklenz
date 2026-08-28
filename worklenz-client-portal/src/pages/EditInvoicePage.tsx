import React, { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Flex,
  Button,
  Row,
  Col,
  Spin,
  Alert,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  message,
  LeftOutlined,
} from "@/shared/antd-imports";
import { useNavigate, useParams } from "react-router-dom";
import clientPortalAPI from "@/services/api";
import { InvoiceDetails } from "@/types";
import { CURRENCY_OPTIONS } from "@/shared/currencies";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;

const EditInvoicePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchInvoiceDetails();
    }
  }, [id]);

  const fetchInvoiceDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await clientPortalAPI.getInvoiceDetails(id!);

      if (response.done) {
        const data = response.body as InvoiceDetails;
        setInvoice(data);
        
        // Check if invoice is paid - if so, prevent editing
        if (data.status?.toLowerCase() === "paid") {
          setError("Paid invoices cannot be edited.");
          setIsLoading(false);
          return;
        }

        // Populate form with invoice data
        form.setFieldsValue({
          amount: data.amount,
          currency: data.currency,
          dueDate: data.dueDate ? dayjs(data.dueDate) : null,
          notes: data.notes || "",
        });
      } else {
        setError("Failed to load invoice details");
      }
    } catch (err) {
      setError("Failed to load invoice details. Please try again later.");
      console.error("Invoice details API error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!invoice || invoice.status?.toLowerCase() === "paid") {
      message.error("Paid invoices cannot be edited.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const updateData = {
        amount: values.amount,
        currency: values.currency,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
        notes: values.notes || "",
      };

      // Note: You'll need to implement this API endpoint in the backend
      const response = await clientPortalAPI.updateInvoice(id!, updateData);

      if (response.done) {
        message.success("Invoice updated successfully");
        navigate(`/invoices/${id}`);
      } else {
        message.error(response.message || "Failed to update invoice");
      }
    } catch (err) {
      console.error("Update invoice error:", err);
      message.error("Failed to update invoice. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/invoices/${id}`);
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", padding: 24, width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "400px",
          }}
        >
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ minHeight: "100vh", padding: 24, width: "100%" }}>
        <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
          <Button
            icon={<LeftOutlined />}
            onClick={() => navigate(-1)}
            type="text"
            style={{ boxShadow: "none" }}
          />
          <Title level={4} style={{ margin: 0 }}>
            Edit Invoice
          </Title>
        </Flex>
        <Card style={{ borderRadius: 10 }}>
          <Alert message="Error" description={error || "Invoice not found"} type="error" showIcon />
        </Card>
      </div>
    );
  }

  // Prevent editing if invoice is paid
  if (invoice.status?.toLowerCase() === "paid") {
    return (
      <div style={{ minHeight: "100vh", padding: 24, width: "100%" }}>
        <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
          <Button
            icon={<LeftOutlined />}
            onClick={() => navigate(-1)}
            type="text"
            style={{ boxShadow: "none" }}
          />
          <Title level={4} style={{ margin: 0 }}>
            Edit Invoice
          </Title>
        </Flex>
        <Card style={{ borderRadius: 10 }}>
          <Alert
            message="Cannot Edit Paid Invoice"
            description="This invoice has been paid and cannot be edited."
            type="warning"
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%" }}>
      <div style={{ width: "100%" }}>
        {/* Header */}
        <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
          <Button
            icon={<LeftOutlined />}
            onClick={handleCancel}
            type="text"
            style={{ boxShadow: "none" }}
          />
          <Title level={4} style={{ margin: 0 }}>
            Edit Invoice - {invoice.invoiceNumber}
          </Title>
        </Flex>

        <Card style={{ borderRadius: 10, width: "100%" }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              amount: invoice.amount,
              currency: invoice.currency,
              dueDate: invoice.dueDate ? dayjs(invoice.dueDate) : null,
              notes: invoice.notes || "",
            }}
          >
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label="Invoice Amount"
                  name="amount"
                  rules={[
                    { required: true, message: "Please enter invoice amount" },
                    { type: "number", min: 0.01, message: "Amount must be greater than 0" },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    placeholder="Enter amount"
                    precision={2}
                    prefix="$"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Currency"
                  name="currency"
                  rules={[{ required: true, message: "Please select currency" }]}
                >
                  <Select
                    placeholder="Select currency"
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.children as unknown as string)
                        ?.toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  >
                    {CURRENCY_OPTIONS.map(currency => (
                      <Option key={currency.value} value={currency.value}>
                        {currency.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label="Due Date"
                  name="dueDate"
                >
                  <DatePicker
                    style={{ width: "100%" }}
                    placeholder="Select due date"
                    disabledDate={(current: any) => current && current < dayjs().startOf("day")}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Current Status">
                  <Text strong style={{ textTransform: "capitalize" }}>
                    {invoice.status}
                  </Text>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Notes"
              name="notes"
            >
              <Input.TextArea
                rows={4}
                placeholder="Add any additional notes..."
              />
            </Form.Item>

            {/* Invoice Information Display */}
            <Row gutter={24} style={{ marginTop: 24, marginBottom: 24 }}>
              <Col span={24}>
                <Card size="small" style={{ backgroundColor: "#f5f5f5" }}>
                  <Title level={5} style={{ marginBottom: 16 }}>
                    Invoice Information
                  </Title>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text type="secondary">Invoice Number:</Text>
                      <br />
                      <Text strong>{invoice.invoiceNumber}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Client:</Text>
                      <br />
                      <Text strong>{invoice.client?.name || "N/A"}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Created:</Text>
                      <br />
                      <Text strong>
                        {invoice.createdAt
                          ? new Date(invoice.createdAt).toLocaleDateString()
                          : "N/A"}
                      </Text>
                    </Col>
                  </Row>
                  {invoice.request && (
                    <Row gutter={16} style={{ marginTop: 12 }}>
                      <Col span={24}>
                        <Text type="secondary">Service:</Text>
                        <br />
                        <Text strong>{invoice.request.service?.name || "N/A"}</Text>
                      </Col>
                    </Row>
                  )}
                </Card>
              </Col>
            </Row>

            {/* Action Buttons */}
            <Flex gap={12} justify="flex-end">
              <Button onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isSubmitting}
              >
                Update Invoice
              </Button>
            </Flex>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default EditInvoicePage;
