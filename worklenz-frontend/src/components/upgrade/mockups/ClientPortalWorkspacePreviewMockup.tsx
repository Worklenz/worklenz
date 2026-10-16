import React from 'react';
import { Card, Flex, Typography, theme } from '@/shared/antd-imports';

const { Title, Text } = Typography;

interface ClientPortalWorkspacePreviewMockupProps {
  title: string;
  description: string;
  /** Column headings of the sample table. */
  columns: string[];
}

/**
 * A neutral skeleton of a Client Portal list page for the locked (non-Business) view: the page's real
 * title and description, four stat tiles and a table made of placeholder bars. It carries no sample
 * data, so there is nothing extra to translate and nothing that could be mistaken for real records.
 */
const ClientPortalWorkspacePreviewMockup: React.FC<ClientPortalWorkspacePreviewMockupProps> = ({
  title,
  description,
  columns,
}) => {
  const { token } = theme.useToken();
  const bar = (width: number | string, height = 10) => (
    <div style={{ width, height, borderRadius: 4, background: token.colorFillSecondary }} />
  );

  return (
    <Flex vertical gap={16} style={{ height: '100%' }} aria-hidden>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {description}
        </Text>
      </div>

      <Flex gap={12} wrap="wrap">
        {[0, 1, 2, 3].map(index => (
          <Card key={index} size="small" style={{ flex: '1 1 140px' }}>
            <Flex vertical gap={8}>
              {bar('55%')}
              {bar(48, 22)}
            </Flex>
          </Card>
        ))}
      </Flex>

      <Card style={{ flex: 1, minHeight: 0 }} styles={{ body: { padding: 0 } }}>
        <Flex
          gap={16}
          style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
        >
          {columns.map(column => (
            <Text key={column} strong style={{ flex: 1, fontSize: 12 }}>
              {column}
            </Text>
          ))}
        </Flex>
        {[0, 1, 2, 3, 4].map(row => (
          <Flex
            key={row}
            gap={16}
            align="center"
            style={{ padding: '14px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
          >
            {columns.map((column, index) => (
              <div key={column} style={{ flex: 1 }}>
                {bar(index === 0 ? '70%' : '45%')}
              </div>
            ))}
          </Flex>
        ))}
      </Card>
    </Flex>
  );
};

export default ClientPortalWorkspacePreviewMockup;
