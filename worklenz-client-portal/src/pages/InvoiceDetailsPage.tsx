import React, { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Flex,
  Button,
  Row,
  Col,
  Tag,
  Spin,
  Alert,
  Modal,
  Upload,
  Input,
  message,
  LeftOutlined,
  UploadOutlined,
  DownloadOutlined,
} from "@/shared/antd-imports";
import { useNavigate, useParams } from "react-router-dom";
import clientPortalAPI from "@/services/api";
import { stripHtml } from "@/utils/escapeHtml";
import { InvoiceDetails } from "@/types";
import type { UploadFile } from "antd/es/upload/interface";

const { Title, Text } = Typography;
const { TextArea } = Input;

const InvoiceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<UploadFile[]>([]);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleDownloadInvoice = async () => {
    try {
      setIsDownloading(true);

      // Create a direct fetch request to handle PDF download
      const token = clientPortalAPI.getToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/client-portal';

      const response = await fetch(`${baseUrl}/invoices/${id}/download?format=pdf`, {
        method: 'GET',
        headers: {
          'x-client-token': token || '',
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');

        // Get the filename from Content-Disposition header or create a default one
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `invoice-${invoice?.invoiceNumber || 'unknown'}.pdf`;

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }

        // Use arrayBuffer for better binary data handling
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: contentType || 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        if (contentType?.includes('application/pdf')) {
          message.success("Invoice PDF downloaded successfully");
        } else {
          message.success("Invoice downloaded successfully (HTML format)");
        }
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => ({}));
        message.error(errorData.message || "Failed to download invoice");
      }
    } catch (err) {
      console.error("Download error:", err);
      message.error("Failed to download invoice. Please try again later.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmitPaymentProof = async () => {
    try {
      setIsSubmittingPayment(true);

      let proofUrl = "";
      if (paymentProofFile.length > 0 && paymentProofFile[0].originFileObj) {
        const uploadResponse = await clientPortalAPI.uploadFile(
          paymentProofFile[0].originFileObj,
          "payment_proof"
        );
        if (!uploadResponse.done) {
          const errorMessage = uploadResponse.message || "Failed to upload payment proof file";
          message.error(errorMessage);
          throw new Error(errorMessage);
        }
        proofUrl = uploadResponse.body.url;
      }

      const response = await clientPortalAPI.payInvoice(id!, {
        notes: paymentNotes,
        transactionId: proofUrl,
      });

      if (!response.done) {
        const errorMessage = response.message || "Failed to submit payment proof";
        message.error(errorMessage);
        throw new Error(errorMessage);
      }

      message.success("Payment proof submitted successfully");
      setIsPaymentModalVisible(false);
      setPaymentNotes("");
      setPaymentProofFile([]);
      fetchInvoiceDetails();
    } catch (err: any) {
      // Show error message for unexpected errors (network errors, etc.)
      // Note: Expected errors (upload/payment failures) already show messages above
      if (err?.response && !err?.message?.includes("Failed to")) {
        const errorMessage = err?.response?.data?.message || "An unexpected error occurred";
        message.error(errorMessage);
      }
      console.error("Payment submission error:", err);
      // Re-throw to prevent modal from closing on error
      throw err;
    } finally {
      setIsSubmittingPayment(false);
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
            Invoice Details
          </Title>
        </Flex>
        <Card style={{ borderRadius: 10 }}>
          <Alert message="Error" description={error || "Invoice not found"} type="error" showIcon />
        </Card>
      </div>
    );
  }

  const invoiceNumber = invoice.invoiceNumber || "N/A";
  const invoiceTotal = invoice.amount || 0;
  const currency = invoice.currency || "USD";
  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString()
    : "N/A";
  const invoiceDate = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString()
    : "N/A";

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%" }}>
      <div style={{ width: "100%" }}>
        {/* Header */}
        <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
          <Button
            icon={<LeftOutlined />}
            onClick={() => navigate(-1)}
            type="text"
            style={{ boxShadow: "none" }}
          />
          <Title level={4} style={{ margin: 0 }}>
            {invoiceNumber}
          </Title>
          <Tag color={getStatusColor(invoice.status)}>{getStatusText(invoice.status)}</Tag>
        </Flex>

        <Card style={{ borderRadius: 10, marginBottom: 24, width: "100%" }}>
          {/* Invoice meta and details */}
          <Row gutter={32} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Text type="secondary">Billed to</Text>
              <div style={{ marginTop: 4 }}>
                <Text strong>{invoice.client?.name || "Client"}</Text>
                <br />
                <Text>{invoice.client?.companyName}</Text>
                <br />
                <Text>{invoice.client?.email}</Text>
              </div>
            </Col>
            <Col span={12}>
              <Row>
                <Col span={12}>
                  <Text type="secondary">Invoice #</Text>
                  <br />
                  <Text strong>{invoiceNumber}</Text>
                </Col>
                <Col span={12} style={{ textAlign: "right" }}>
                  <Text type="secondary">Invoice Amount</Text>
                  <br />
                  <Title level={3} style={{ color: "#3aaf85", margin: 0 }}>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: currency,
                    }).format(invoiceTotal)}
                  </Title>
                </Col>
              </Row>
              <Row style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Text type="secondary">Issue Date</Text>
                  <br />
                  <Text strong>{invoiceDate}</Text>
                </Col>
                <Col span={12} style={{ textAlign: "right" }}>
                  <Text type="secondary">Due Date</Text>
                  <br />
                  <Text strong>{dueDate}</Text>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* Service/Request Info */}
          {invoice.request && (
            <Row gutter={32} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Text type="secondary">Service</Text>
                <br />
                <Text strong>{invoice.request.service?.name || "N/A"}</Text>
                <br />
                <Text>
                  {stripHtmlTags(invoice.request.service?.description || "")}
                </Text>
              </Col>
            </Row>
          )}

          {/* Action Buttons */}
          <Flex gap={12} wrap="wrap">
            {invoice.status.toLowerCase() === "sent" && (
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setIsPaymentModalVisible(true)}
              >
                Submit Payment Proof
              </Button>
            )}
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadInvoice}
              loading={isDownloading}
            >
              Download Invoice
            </Button>
          </Flex>
        </Card>
      </div>

      {/* Payment Proof Modal */}
      <Modal
        title="Submit Payment Proof"
        open={isPaymentModalVisible}
        onCancel={() => setIsPaymentModalVisible(false)}
        onOk={handleSubmitPaymentProof}
        confirmLoading={isSubmittingPayment}
        width={600}
      >
        <Flex vertical gap={16} style={{ marginTop: 16 }}>
          <Alert
            message="Payment Confirmation"
            description="Upload proof of payment and add any additional notes. This will notify the team that payment has been made."
            type="info"
            showIcon
          />

          <Flex vertical gap={8}>
            <Text strong>Payment Amount:</Text>
            <Text style={{ fontSize: 18 }}>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency,
              }).format(invoiceTotal)}
            </Text>
          </Flex>

          <Flex vertical gap={8}>
            <Text strong>Upload Payment Proof</Text>
            <Upload
              maxCount={1}
              fileList={paymentProofFile}
              onChange={({ fileList }) => setPaymentProofFile(fileList)}
              beforeUpload={() => false}
              accept="image/*,.pdf"
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
            <Text type="secondary">Supported formats: Images, PDF</Text>
          </Flex>

          <Flex vertical gap={8}>
            <Text strong>Notes (Optional)</Text>
            <TextArea
              rows={4}
              placeholder="Add transaction reference, payment method, or any additional notes..."
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </Flex>
        </Flex>
      </Modal>
    </div>
  );
};

const stripHtmlTags = (value: string): string => stripHtml(value);

export default InvoiceDetailsPage;