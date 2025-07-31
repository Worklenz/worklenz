import React from 'react';
import { Card, Typography, Flex } from 'antd';

const { Title, Paragraph } = Typography;

const InvoicesPage: React.FC = () => {
  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex vertical gap={8}>
        <Title level={1} style={{ margin: 0 }}>Invoices</Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          View and manage your invoices and payments
        </Paragraph>
      </Flex>
      
      <Card style={{ height: 'calc(100vh - 248px)' }}>
        <p>Invoices page coming soon...</p>
      </Card>
    </Flex>
  );
};

export default InvoicesPage; 