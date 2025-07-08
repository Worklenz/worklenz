import { Col, ConfigProvider, Flex, Layout } from 'antd';
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useMediaQuery } from 'react-responsive';
import { colors } from '../styles/colors';
import ClientPortalSidebar from '../pages/client-portal/sidebar/client-portal-sidebar';
import Navbar from '@/features/navbar/navbar';
import { clientPortalItems } from '../lib/client-portal/client-portal-constants';

const ClientPortalLayout = () => {
  // theme details from theme slice
  const themeMode = useAppSelector((state) => state.themeReducer.mode);
  // useMediaQuery hook to check if the screen is desktop or not
  const isDesktop = useMediaQuery({ query: '(min-width: 1024px)' });

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            colorBgLayout:
              themeMode === 'dark' ? colors.darkGray : colors.white,
            headerBg: themeMode === 'dark' ? colors.darkGray : colors.white,
          },
        },
      }}
    >
      <Layout
        style={{
          minHeight: '100vh',
        }}
      >
        <Layout.Header
          className={`shadow-md ${themeMode === 'dark' ? '' : 'shadow-[#18181811]'}`}
          style={{
            zIndex: 999,
            position: 'fixed',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
            borderBottom: themeMode === 'dark' ? '1px solid #303030' : '',
          }}
        >
          <Navbar />
        </Layout.Header>

        <Layout.Content>
          <Col
            style={{
              paddingInline: isDesktop ? 64 : 24,
              marginBlockStart: 96,
              overflowX: 'hidden',
            }}
          >
            <Flex
              gap={24}
              align="flex-start"
              style={{
                width: '100%',
              }}
            >
              <Flex style={{ width: '100%', maxWidth: 240 }}>
                <ClientPortalSidebar items={clientPortalItems} />
              </Flex>
              <Flex style={{ width: '100%' }}>
                <Outlet />
              </Flex>
            </Flex>
          </Col>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
};

export default ClientPortalLayout;
