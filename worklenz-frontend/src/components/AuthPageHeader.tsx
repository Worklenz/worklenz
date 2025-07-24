import { Flex, Typography } from '@/shared/antd-imports';
import logo from '@/assets/images/worklenz-light-mode.png';
import logoDark from '@/assets/images/worklenz-dark-mode.png';
import { useAppSelector } from '@/hooks/useAppSelector';

type AuthPageHeaderProp = {
  description: string;
};

// this page header used in only in auth pages
const AuthPageHeader = ({ description }: AuthPageHeaderProp) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  return (
    <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
      <img
        src={themeMode === 'dark' ? logoDark : logo}
        alt="worklenz logo"
        style={{ width: '100%', maxWidth: 220 }}
      />
      <Typography.Text style={{ color: '#8c8c8c', maxWidth: 400, textAlign: 'center' }}>
        {description}
      </Typography.Text>
    </Flex>
  );
};

export default AuthPageHeader;
