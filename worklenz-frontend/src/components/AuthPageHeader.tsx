import { Typography } from '@/shared/antd-imports';

type AuthPageHeaderProp = {
  title?: string;
  description: string;
};

// this page header used in only in auth pages
const AuthPageHeader = ({ title, description }: AuthPageHeaderProp) => {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      {title && (
        <Typography.Title
          level={3}
          style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 8 }}
        >
          {title}
        </Typography.Title>
      )}
      <Typography.Text type="secondary" style={{ fontSize: 13.5, display: 'block' }}>
        {description}
      </Typography.Text>
    </div>
  );
};

export default AuthPageHeader;
