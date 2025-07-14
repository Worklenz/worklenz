import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { Card, Typography, Button, Descriptions, Flex, Row, Col, Table, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { LeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';

const companyInfo = {
  logo: '', // Add logo url if available
  name: 'ClientEarth',
  website: 'www.website.com',
  email: 'hello@email.com',
  phone: '+91 00000 00000',
  address: 'City, State, IN - 000 000',
  taxId: 'TAX ID 0XXXXXX1234X0XX',
};

const businessAddress = {
  address: 'City, State, IN - 000 000',
  taxId: 'TAX ID 0XXXXXX1234X0XX',
};

const clientInfo = {
  name: 'Company Name',
  address: 'Company address',
  city: 'City, Country - 00000',
  phone: '+0 (000) 123-4567',
};

const items = [
  {
    key: '1',
    name: 'Service Name',
    description: 'Service description',
    qty: 1,
    rate: 3000,
    amount: 3000,
  },
  {
    key: '2',
    name: 'Service Name',
    description: 'Service description',
    qty: 1,
    rate: 1500,
    amount: 1500,
  },
];

const total = 4950;

const ClientPortalInvoiceDetails = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('client-portal-invoices');

  // Get invoice from Redux
  const invoice = useAppSelector(
    state => state.clientsPortalReducer.invoicesReducer.invoices.find(inv => inv.id === invoiceId)
  );

  // For now, use mock data for meta fields if invoice is not found
  const invoice_no = invoice?.invoice_no || '#AB2324-01';
  const reference = 'INV-057';
  const subject = 'Design System';
  const invoice_date = invoice?.issued_time || '01 Aug, 2023';
  const due_date = '15 Aug, 2023';
  const invoice_total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div style={{ minHeight: '100vh', padding: 24, width: '100%' }}>
      <div style={{ width: '100%' }}>
        {/* Header */}
        <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
          <Button icon={<LeftOutlined />} onClick={() => navigate(-1)} />
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
                <Typography.Text strong style={{ fontSize: 18 }}>{companyInfo.name}</Typography.Text>
              </Flex>
              <Typography.Text>{companyInfo.website}</Typography.Text><br />
              <Typography.Text>{companyInfo.email}</Typography.Text><br />
              <Typography.Text>{companyInfo.phone}</Typography.Text>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Typography.Text>{t('businessAddress') || 'Business address'}</Typography.Text><br />
              <Typography.Text>{businessAddress.address}</Typography.Text><br />
              <Typography.Text>{businessAddress.taxId}</Typography.Text>
              <EditOutlined style={{ marginLeft: 8, color: '#bfbfbf', cursor: 'pointer' }} />
            </Col>
          </Row>
          {/* Invoice meta and billed to */}
          <Row gutter={32} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Typography.Text style={{ fontWeight: 500 }}>{t('billedTo') || 'Billed to'}</Typography.Text>
              <EditOutlined style={{ marginLeft: 8, color: '#bfbfbf', cursor: 'pointer' }} />
              <div style={{ marginTop: 4 }}>
                <Typography.Text strong>{clientInfo.name}</Typography.Text><br />
                <Typography.Text>{clientInfo.address}</Typography.Text><br />
                <Typography.Text>{clientInfo.city}</Typography.Text><br />
                <Typography.Text>{clientInfo.phone}</Typography.Text>
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
          {/* Service table */}
          <Table
            dataSource={items}
            pagination={false}
            style={{ marginTop: 16, width: '100%' }}
            columns={[
              {
                title: <span>{t('serviceDetail')}</span>,
                dataIndex: 'name',
                key: 'name',
                render: (text, record) => (
                  <div>
                    <Typography.Text strong>{text}</Typography.Text>
                    <EditOutlined style={{ marginLeft: 8, color: '#bfbfbf', cursor: 'pointer' }} />
                    <br />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Typography.Text>
                  </div>
                ),
              },
              {
                title: <span>{t('qty')}</span>,
                dataIndex: 'qty',
                key: 'qty',
              },
              {
                title: <span>{t('rate')}</span>,
                dataIndex: 'rate',
                key: 'rate',
                render: (rate) => `$${rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              },
              {
                title: <span>{t('amount')}</span>,
                dataIndex: 'amount',
                key: 'amount',
                render: (amount) => `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              },
            ]}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3} align="right">
                  <Typography.Text strong>{t('total')}</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Typography.Text strong style={{ color: '#3aaf85' }}>
                    ${invoice_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Typography.Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
          <div style={{ marginTop: 8 }}>
            <a style={{ color: '#3aaf85', fontWeight: 500, cursor: 'pointer' }}>
              <PlusOutlined /> {t('addNew') || 'Add new'}
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ClientPortalInvoiceDetails; 