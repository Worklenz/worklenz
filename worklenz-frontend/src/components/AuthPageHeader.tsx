// PPM-OVERRIDE: Replace Worklenz logo with PPM branding
import { Flex, Typography } from '@/shared/antd-imports';
import PPMLogo from '@/components/ppm/PPMLogo';

type AuthPageHeaderProp = {
  description: string;
};

// this page header used in only in auth pages
const AuthPageHeader = ({ description }: AuthPageHeaderProp) => {
  return (
    <Flex vertical align="center" gap={12} style={{ marginBottom: 24 }}>
      <PPMLogo size="large" showSubtitle={true} />
      <Typography.Text style={{ color: '#8c8c8c', maxWidth: 400, textAlign: 'center' }}>
        {description}
      </Typography.Text>
    </Flex>
  );
};

export default AuthPageHeader;
