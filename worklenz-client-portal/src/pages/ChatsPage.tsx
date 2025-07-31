import React from 'react';
import { Card, Typography, Flex } from 'antd';

const { Title, Paragraph } = Typography;

const ChatsPage: React.FC = () => {
  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex vertical gap={8}>
        <Title level={1} style={{ margin: 0 }}>Chats</Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Communicate with your service providers
        </Paragraph>
      </Flex>
      
      <Card style={{ height: 'calc(100vh - 248px)' }}>
        <p>Chats page coming soon...</p>
      </Card>
    </Flex>
  );
};

export default ChatsPage; 