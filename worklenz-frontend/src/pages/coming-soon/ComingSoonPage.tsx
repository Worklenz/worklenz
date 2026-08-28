import type { ReactNode } from 'react';
import { Typography } from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';

const { Title, Text } = Typography;

interface ComingSoonPageProps {
  title: string;
  icon: ReactNode;
}

// Shared landing page for nav items that don't have a real feature behind
// them yet — gives them somewhere to land (instead of being dead/disabled)
// while making the "not built yet" status obvious.
const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ title, icon }) => {
  useDocumentTitle(title);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: '60vh',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 32, opacity: 0.45, display: 'flex' }}>{icon}</span>
      <Title level={4} style={{ margin: 0 }}>
        {title}
      </Title>
      <Text type="secondary">Coming soon.</Text>
    </div>
  );
};

export default ComingSoonPage;
