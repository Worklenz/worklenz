import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { Card, Typography, Button, Descriptions, Flex, Row, Col, Table, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { LeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';



const ClientPortalInvoiceDetails = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('client-portal-invoices');

  // Get invoice from Redux
  const invoice = useAppSelector(
    state => state.clientsPortalReducer.invoicesReducer.invoices.find(inv => inv.id === invoiceId)
  );

  // Use actual invoice data with fallbacks
  const invoice_no = invoice?.invoice_no || 'N/A';
  const reference = 'N/A';
  const subject = 'N/A';
  const invoice_date = 'N/A';
  const due_date = 'N/A';
  const invoice_total = 0;

  return (
    <div style={{ minHeight: '100vh', padding: 24, width: '100%' }}>
      <div style={{ width: '100%' }}>
        {/* Header */}
        <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
          <Button icon={<LeftOutlined />} onClick={() => navigate(-1)} type="text" style={{ boxShadow: 'none' }} />
          <Typography.Title level={4} style={{ margin: 0 }}>{invoice_no}</Typography.Title>
        </Flex>
        <Card style={{ borderRadius: 10, marginBottom: 24, width: '100%' }}>
          {/* Top summary: company info and business address */}
          <Row gutter={32} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
                {/* Logo placeholder */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24, color: '#3aaf85' }}>
                  CE
                </div>
                <Typography.Text strong style={{ fontSize: 18 }}>Company Name</Typography.Text>
              </Flex>
              <Typography.Text>www.company.com</Typography.Text><br />
              <Typography.Text>hello@company.com</Typography.Text><br />
              <Typography.Text>+1 (555) 123-4567</Typography.Text>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Typography.Text>{t('businessAddress') || 'Business address'}</Typography.Text><br />
              <Typography.Text>Business Address</Typography.Text><br />
              <Typography.Text>Tax ID</Typography.Text>
              <EditOutlined style={{ marginLeft: 8, color: '#bfbfbf', cursor: 'pointer' }} />
            </Col>
          </Row>
          {/* Invoice meta and billed to */}
          <Row gutter={32} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Typography.Text style={{ fontWeight: 500 }}>{t('billedTo') || 'Billed to'}</Typography.Text>
              <EditOutlined style={{ marginLeft: 8, color: '#bfbfbf', cursor: 'pointer' }} />
              <div style={{ marginTop: 4 }}>
                <Typography.Text strong>Client Name</Typography.Text><br />
                <Typography.Text>Client Address</Typography.Text><br />
                <Typography.Text>Client City</Typography.Text><br />
                <Typography.Text>Client Phone</Typography.Text>
              </div>
            </Col>
            <Col span={12}>
              <Row>
                <Col span={12}>
                  <Typography.Text type="secondary">{t('invoiceNoColumn')}</Typography.Text><br />
                  <Typography.Text strong>{invoice_no}</Typography.Text>
                </Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                  <Typography.Text type="secondary">{t('invoiceOf')}</Typography.Text><br />
                  <Typography.Title level={3} style={{ color: '#3aaf85', margin: 0 }}>
                    ${invoice_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Typography.Title>
                </Col>
              </Row>
              <Row style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Typography.Text type="secondary">{t('reference')}</Typography.Text><br />
                  <Typography.Text strong>{reference}</Typography.Text>
                </Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                  <Typography.Text type="secondary">{t('date')}</Typography.Text><br />
                  <Typography.Text strong>{due_date}</Typography.Text>
                </Col>
              </Row>
            </Col>
          </Row>
          <Row gutter={32} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Typography.Text type="secondary">{t('subject')}</Typography.Text>
              <EditOutlined style={{ marginLeft: 8, color: '#bfbfbf', cursor: 'pointer' }} />
              <br />
              <Typography.Text strong>{subject}</Typography.Text>
            </Col>
            <Col span={12}>
              <Typography.Text type="secondary">{t('invoiceDate')}</Typography.Text>
              <br />
              <Typography.Text strong>{invoice_date}</Typography.Text>
              <EditOutlined style={{ marginLeft: 8, color: '#bfbfbf', cursor: 'pointer' }} />
            </Col>
          </Row>
          {/* Service table placeholder */}
          <div style={{ marginTop: 16, padding: 24, textAlign: 'center', background: '#f5f5f5', borderRadius: 8 }}>
            <Typography.Text type="secondary">Service items will be displayed here when available</Typography.Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ClientPortalInvoiceDetails; 