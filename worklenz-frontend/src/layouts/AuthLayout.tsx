import { ConfigProvider, Flex, Layout } from '@/shared/antd-imports';
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { colors } from '../styles/colors';

const AuthLayout = () => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            colorBgLayout: themeMode === 'dark' ? colors.darkGray : '#fafafa',
          },
        },
      }}
    >
      <Layout
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: '100vh',
          width: '100%',
        }}
      >
        <Flex
          style={{
            marginBlockStart: 96,
            marginBlockEnd: 48,
            marginInline: 24,
            width: '90%',
            maxWidth: 440,
          }}
        >
          <Outlet />
        </Flex>
      </Layout>
    </ConfigProvider>
  );
};

export default AuthLayout;
