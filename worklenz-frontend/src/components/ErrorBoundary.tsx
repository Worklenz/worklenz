import React from 'react';
import { Button, Result, Collapse, Typography, Flex, Space, Card } from '@/shared/antd-imports';
import {
  ReloadOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  DownOutlined,
  RightOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import logger from '@/utils/errorLogger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
  isManualReset: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  private resizeTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0, isManualReset: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Check if this might be a resize-related error
    const isResizeRelatedError =
      error?.message?.includes('Cannot read') ||
      error?.message?.includes('undefined') ||
      error?.stack?.includes('resize') ||
      error?.name === 'TypeError';

    // If it's a resize-related error and we haven't retried too many times, try to recover
    if (isResizeRelatedError) {
      return { hasError: true, error, retryCount: 0, isManualReset: false };
    }

    return { hasError: true, error, retryCount: 0, isManualReset: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by ErrorBoundary:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    console.error('Error caught by ErrorBoundary:', error);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Don't auto-recover if user manually triggered a reset
    if (this.state.isManualReset) {
      return;
    }

    // Auto-recover from resize-related errors after window resize stabilizes
    if (this.state.hasError && this.state.retryCount < 2) {
      const isResizeRelatedError =
        this.state.error?.message?.includes('Cannot read') ||
        this.state.error?.message?.includes('undefined') ||
        this.state.error?.stack?.includes('resize') ||
        this.state.error?.name === 'TypeError';

      if (isResizeRelatedError) {
        // Clear any existing timeout
        if (this.resizeTimeoutId) {
          clearTimeout(this.resizeTimeoutId);
        }

        // Auto-recover after resize stabilizes (500ms)
        this.resizeTimeoutId = setTimeout(() => {
          this.setState({
            hasError: false,
            error: undefined,
            retryCount: this.state.retryCount + 1,
            isManualReset: false,
          });
          this.resizeTimeoutId = null;
        }, 500);
      }
    }
  }

  componentWillUnmount() {
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
      this.resizeTimeoutId = null;
    }
  }

  handleReset = () => {
    // Clear any active timeout
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
      this.resizeTimeoutId = null;
    }

    // Reset error state and mark as manual reset
    this.setState({
      hasError: false,
      error: undefined,
      retryCount: 0,
      isManualReset: true,
    });

    // Reset the manual reset flag after a brief delay to allow re-render
    // This prevents componentDidUpdate from interfering
    setTimeout(() => {
      this.setState({ isManualReset: false });
    }, 100);
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

const ErrorFallback: React.FC<{ error?: Error; onReset?: () => void }> = ({ error, onReset }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handleRetry = () => {
    if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    navigate('/worklenz/home');
    window.location.reload();
  };

  const errorMessage = error?.message || t('error.unknownError', 'An unknown error occurred');
  const errorStack = error?.stack;

  // Theme-aware colors
  const backgroundColor = themeMode === 'dark' ? '#141414' : '#fafafa';
  const borderColor = themeMode === 'dark' ? '#434343' : '#d9d9d9';
  const textColor = themeMode === 'dark' ? '#ffffff' : 'rgba(0, 0, 0, 0.85)';
  const secondaryTextColor = themeMode === 'dark' ? '#bfbfbf' : 'rgba(0, 0, 0, 0.45)';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor,
        transition: 'background-color 0.3s ease',
      }}
    >
      <Card
        style={{
          maxWidth: '600px',
          width: '100%',
          boxShadow:
            themeMode === 'dark'
              ? '0 4px 12px rgba(0, 0, 0, 0.5)'
              : '0 4px 12px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
        }}
        styles={{ body: { padding: '32px' } }}
      >
        <Result
          status="error"
          title={
            <Typography.Title
              level={3}
              style={{
                margin: 0,
                color: textColor,
                fontWeight: 600,
              }}
            >
              {t('error.somethingWentWrong', 'Something went wrong')}
            </Typography.Title>
          }
          subTitle={
            <Typography.Text
              style={{
                fontSize: '16px',
                color: secondaryTextColor,
                display: 'block',
                marginTop: '8px',
              }}
            >
              {t(
                'error.description',
                'We encountered an unexpected error. Please try again or return to the home page.'
              )}
            </Typography.Text>
          }
          extra={
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Flex gap="middle" justify="center" wrap>
                <Button
                  type="primary"
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={handleRetry}
                  style={{
                    minWidth: '140px',
                    height: '40px',
                    borderRadius: '6px',
                    fontWeight: 500,
                  }}
                >
                  {t('error.retry', 'Try Again')}
                </Button>
                <Button
                  size="large"
                  icon={<HomeOutlined />}
                  onClick={handleGoHome}
                  style={{
                    minWidth: '140px',
                    height: '40px',
                    borderRadius: '6px',
                    fontWeight: 500,
                  }}
                >
                  {t('error.goHome', 'Go Home')}
                </Button>
              </Flex>

              {error && (
                <Collapse
                  ghost
                  expandIcon={panelProps =>
                    panelProps.isActive ? (
                      <DownOutlined
                        style={{
                          color: themeMode === 'dark' ? '#1890ff' : '#1890ff',
                        }}
                      />
                    ) : (
                      <RightOutlined
                        style={{
                          color: themeMode === 'dark' ? '#1890ff' : '#1890ff',
                        }}
                      />
                    )
                  }
                  items={[
                    {
                      key: '1',
                      label: (
                        <Flex align="center" gap="small">
                          <InfoCircleOutlined
                            style={{
                              color: themeMode === 'dark' ? '#1890ff' : '#1890ff',
                            }}
                          />
                          <Typography.Text
                            style={{
                              color: themeMode === 'dark' ? '#1890ff' : '#1890ff',
                              fontWeight: 500,
                            }}
                          >
                            {t('error.viewDetails', 'View Error Details')}
                          </Typography.Text>
                        </Flex>
                      ),
                      children: (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '16px',
                            backgroundColor: themeMode === 'dark' ? '#1f1f1f' : '#f5f5f5',
                            borderRadius: '6px',
                            border: `1px solid ${borderColor}`,
                          }}
                        >
                          <Typography.Text
                            strong
                            style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: textColor,
                              fontSize: '14px',
                            }}
                          >
                            {t('error.errorMessage', 'Error Message')}:
                          </Typography.Text>
                          <Typography.Text
                            code
                            style={{
                              display: 'block',
                              marginBottom: '16px',
                              color: themeMode === 'dark' ? '#ff4d4f' : '#cf1322',
                              fontSize: '13px',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {errorMessage}
                          </Typography.Text>

                          {errorStack && (
                            <>
                              <Typography.Text
                                strong
                                style={{
                                  display: 'block',
                                  marginBottom: '8px',
                                  marginTop: '16px',
                                  color: textColor,
                                  fontSize: '14px',
                                }}
                              >
                                {t('error.stackTrace', 'Stack Trace')}:
                              </Typography.Text>
                              <Typography.Text
                                code
                                style={{
                                  display: 'block',
                                  color: secondaryTextColor,
                                  fontSize: '12px',
                                  fontFamily: 'monospace',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: '300px',
                                  overflow: 'auto',
                                  lineHeight: '1.6',
                                }}
                              >
                                {errorStack}
                              </Typography.Text>
                            </>
                          )}
                        </div>
                      ),
                    },
                  ]}
                  onChange={() => {}}
                />
              )}
            </Space>
          }
        />
      </Card>
    </div>
  );
};

export default ErrorBoundary;
