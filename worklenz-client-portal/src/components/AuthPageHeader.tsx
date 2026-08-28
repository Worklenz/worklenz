import { Flex, Typography } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import logoLight from '@/assets/images/worklenz-light-mode.png';
import logoDark from '@/assets/images/worklenz-dark-mode.png';

type AuthPageHeaderProp = {
  description: string;
};

// This page header is used only in auth pages for client portal
const AuthPageHeader = ({ description }: AuthPageHeaderProp) => {
  const currentTheme = useAppSelector((state) => state.ui.theme);
  
  return (
    <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
      <img
        src={currentTheme === 'dark' ? logoDark : logoLight}
        alt="Worklenz logo"
        style={{ width: '100%', maxWidth: 220, marginBottom: 8 }}
      />
      <Typography.Title level={2} style={{ 
        color: currentTheme === 'dark' ? '#ffffff' : '#000000',
        margin: 0 
      }}>
        Client Portal
      </Typography.Title>
      <Typography.Text style={{ 
        color: '#8c8c8c', 
        maxWidth: 400, 
        textAlign: 'center' 
      }}>
        {description}
      </Typography.Text>
    </Flex>
  );
};

export default AuthPageHeader; 