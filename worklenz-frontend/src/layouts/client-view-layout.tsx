import { Col, ConfigProvider, Flex, Layout } from 'antd';
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useMediaQuery } from 'react-responsive';
import { colors } from '../styles/colors';
import ClientViewSiderMenu from '../pages/client-view/sidebar/client-view-sider-menu';
import ClientViewLogo from '../assets/images/client-view-logo.png';
import { themeWiseColor } from '../utils/themeWiseColor';

const ClientViewLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          <img
            src={ClientViewLogo}
            alt="client-view-logo"
            style={{ width: 120, height: 40, marginInlineStart: 24 }}
          />
        </Layout.Header>

        <Layout.Content>
          <Col
            style={{
              paddingInlineEnd: isDesktop ? 64 : 24,
              overflowX: 'hidden',
            }}
          >
            <Flex
              gap={24}
              align="flex-start"
              style={{
                width: '100%',
                marginBlockStart: 24,
              }}
            >
              <Flex
                style={{
                  width: '100%',
                  maxWidth: isCollapsed ? 56 : 240,
                  minHeight: 'calc(100vh - 24px)',
                  paddingBlockStart: 84,
                  borderInlineEnd: `1px solid ${themeWiseColor('#f5f5f5', '#303030', themeMode)}`,
                  transition: 'all 0.3s',
                }}
              >
                <ClientViewSiderMenu
                  isCollapsed={isCollapsed}
                  setIsCollapsed={setIsCollapsed}
                />
              </Flex>

              <Flex style={{ width: '100%', marginBlockStart: 96 }}>
                <Outlet />
              </Flex>
            </Flex>
          </Col>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
};

export default ClientViewLayout;
