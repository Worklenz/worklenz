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
  PrinterOutlined,
  DownloadOutlined,
} from "@/shared/antd-imports";
import { useNavigate, useParams } from "react-router-dom";
import clientPortalAPI from "@/services/api";
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
      const response = await clientPortalAPI.downloadInvoice(id!, "pdf");

      if (response.done) {
        const invoiceData = response.body.invoiceData;
        const invoiceNumber = invoiceData.invoiceNumber || "invoice";
        
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Invoice ${invoiceNumber}</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  padding: 40px;
                  max-width: 800px;
                  margin: 0 auto;
                }
                .header {
                  text-align: center;
                  margin-bottom: 40px;
                  border-bottom: 2px solid #333;
                  padding-bottom: 20px;
                }
                .invoice-title {
                  font-size: 32px;
                  font-weight: bold;
                  margin-bottom: 10px;
                }
                .invoice-number {
                  font-size: 18px;
                  color: #666;
                }
                .section {
                  margin-bottom: 30px;
                }
                .section-title {
                  font-size: 14px;
                  color: #666;
                  margin-bottom: 5px;
                }
                .section-content {
                  font-size: 16px;
                  font-weight: bold;
                }
                .grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 30px;
                  margin-bottom: 30px;
                }
                .amount {
                  font-size: 28px;
                  color: #3aaf85;
                  font-weight: bold;
                }
                .status {
                  display: inline-block;
                  padding: 5px 15px;
                  border-radius: 4px;
                  font-size: 14px;
                  font-weight: bold;
                }
                .status-paid { background-color: #d4edda; color: #155724; }
                .status-pending { background-color: #fff3cd; color: #856404; }
                .status-overdue { background-color: #f8d7da; color: #721c24; }
                .footer {
                  margin-top: 60px;
                  padding-top: 20px;
                  border-top: 1px solid #ddd;
                  text-align: center;
                  color: #666;
                  font-size: 12px;
                }
                @media print {
                  body { padding: 20px; }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-number">#${invoiceNumber}</div>
              </div>
              
              <div class="grid">
                <div class="section">
                  <div class="section-title">Billed To</div>
                  <div class="section-content">${invoiceData.client.name || ""}</div>
                  <div>${invoiceData.client.companyName || ""}</div>
                  <div>${invoiceData.client.email || ""}</div>
                  ${invoiceData.client.address ? `<div>${invoiceData.client.address}</div>` : ""}
                </div>
                
                <div style="text-align: right;">
                  <div class="section">
                    <div class="section-title">Invoice Amount</div>
                    <div class="amount">${new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: invoiceData.currency || "USD",
                    }).format(invoiceData.amount || 0)}</div>
                  </div>
                  
                  <div class="section">
                    <div class="section-title">Status</div>
                    <span class="status status-${invoiceData.status?.toLowerCase() || "pending"}">${invoiceData.status || "Pending"}</span>
                  </div>
                </div>
              </div>
              
              <div class="grid">
                <div class="section">
                  <div class="section-title">Issue Date</div>
                  <div class="section-content">${new Date(invoiceData.createdAt).toLocaleDateString()}</div>
                </div>
                
                <div class="section" style="text-align: right;">
                  <div class="section-title">Due Date</div>
                  <div class="section-content">${invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : "N/A"}</div>
                </div>
              </div>
              
              ${invoiceData.service?.name ? `
                <div class="section">
                  <div class="section-title">Service</div>
                  <div class="section-content">${invoiceData.service.name}</div>
                  ${invoiceData.service.description ? `<div style="margin-top: 10px;">${invoiceData.service.description.replace(/<[^>]+>/g, "")}</div>` : ""}
                </div>
              ` : ""}
              
              ${invoiceData.requestNumber ? `
                <div class="section">
                  <div class="section-title">Request Number</div>
                  <div class="section-content">${invoiceData.requestNumber}</div>
                </div>
              ` : ""}
              
              <div class="footer">
                Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
          
          setTimeout(() => {
            printWindow.print();
          }, 250);
        }
        
        message.success("Invoice ready for download");
      } else {
        message.error("Failed to download invoice");
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
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print
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

const stripHtmlTags = (value: string): string =>
  value.replace(/<[^>]+>/g, "").trim();

export default InvoiceDetailsPage;
