import React from 'react';
import { Button, Result } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import logger from '@/utils/errorLogger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

class ErrorBoundary extends React.Component<Props, State> {
  private resizeTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this might be a resize-related error
    const isResizeRelatedError =
      error?.message?.includes('Cannot read') ||
      error?.message?.includes('undefined') ||
      error?.stack?.includes('resize') ||
      error?.name === 'TypeError';

    // If it's a resize-related error and we haven't retried too many times, try to recover
    if (isResizeRelatedError) {
      return { hasError: true, error, retryCount: 0 };
    }

    return { hasError: true, error, retryCount: 0 };
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
          this.setState({ hasError: false, error: undefined, retryCount: this.state.retryCount + 1 });
        }, 500);
      }
    }
  }

  componentWillUnmount() {
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, retryCount: 0 });
  };

  render() {
    if (this.state.hasError && !this.resizeTimeoutId) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

const ErrorFallback: React.FC<{ error?: Error; onReset?: () => void }> = ({ error, onReset }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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

  return (
    <Result
      status="error"
      title={t('error.somethingWentWrong', 'Something went wrong')}
      extra={[
        <Button key="retry" type="primary" onClick={handleRetry}>
          {t('error.retry', 'Try Again')}
        </Button>,
        <Button key="home" onClick={handleGoHome}>
          {t('error.goHome', 'Go Home')}
        </Button>,
      ]}
    />
  );
};

export default ErrorBoundary;
