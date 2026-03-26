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

        {/* PPM-OVERRIDE: Powered by Worklenz footer */}
        <div style={{ textAlign: 'center', padding: '12px 24px', fontSize: 12, color: themeMode === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
          Powered by{' '}
          <a
            href="https://github.com/Worklenz/worklenz"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: themeMode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
          >
            Worklenz
          </a>
        </div>
      </Layout>
    </ConfigProvider>
  );
};

export default AuthLayout;
