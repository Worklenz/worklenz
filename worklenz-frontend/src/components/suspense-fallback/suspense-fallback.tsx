import { colors } from '@/styles/colors';
import { getInitialTheme } from '@/utils/get-initial-theme';
import { ConfigProvider, theme, Layout, Spin } from 'antd';

// Loading component with theme awareness
export const SuspenseFallback = () => {
  const currentTheme = getInitialTheme();
  const isDark = currentTheme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        components: {
          Layout: {
            colorBgLayout: isDark ? colors.darkGray : '#fafafa',
          },
          Spin: {
            colorPrimary: isDark ? '#fff' : '#1890ff',
          },
        },
      }}
    >
      <Layout
        className="app-loading-container"
        style={{
          position: 'fixed',
          width: '100vw',
          height: '100vh',
          background: 'transparent',
          transition: 'none',
        }}
      >
        <Spin
          size="large"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </Layout>
    </ConfigProvider>
  );
};
