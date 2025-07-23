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
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by ErrorBoundary:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    console.error('Error caught by ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

const ErrorFallback: React.FC<{ error?: Error }> = ({ error }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleRetry = () => {
    window.location.reload();
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
