import { useMemo } from 'react';

import { Flex, Typography } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';

const LOGO_LIGHT =
  'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-light-mode.png';
const LOGO_DARK =
  'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-dark-mode.png';

const XMAS_LOGO_LIGHT =
  'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-xmas-light.webp';
const XMAS_LOGO_DARK =
  'https://s3.us-west-2.amazonaws.com/worklenz.com/assets/worklenz-xmas-dark.webp';

type AuthPageHeaderProp = {
  description: string;
};

// this page header used in only in auth pages
const AuthPageHeader = ({ description }: AuthPageHeaderProp) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isChristmasSeason = useMemo(() => {
    const now = new Date();
    return now.getMonth() === 11; // December
  }, []);

  const logoSrc =
    themeMode === 'dark'
      ? isChristmasSeason
        ? XMAS_LOGO_DARK
        : LOGO_DARK
      : isChristmasSeason
        ? XMAS_LOGO_LIGHT
        : LOGO_LIGHT;

  return (
    <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
      <img
        src={logoSrc}
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
