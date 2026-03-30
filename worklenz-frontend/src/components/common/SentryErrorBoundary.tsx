import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { captureException, addBreadcrumb } from '@/config/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class SentryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Add breadcrumb for error boundary trigger
    addBreadcrumb({
      category: 'error',
      message: 'React Error Boundary caught an error',
      level: 'error',
      data: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'SentryErrorBoundary',
      },
    });

    // Capture the exception with additional context
    captureException(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: 'SentryErrorBoundary',
      reactVersion: React.version,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    // Add breadcrumb for manual reset
    addBreadcrumb({
      category: 'user',
      message: 'User manually reset error boundary',
      level: 'info',
    });

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full p-6">
            <Result
              status="500"
              title="Something went wrong"
              subTitle="We're sorry, but something unexpected happened. Our team has been notified and is working on a fix."
              extra={[
                <Button type="primary" key="home" onClick={() => (window.location.href = '/')}>
                  Go Home
                </Button>,
                <Button key="retry" onClick={this.handleReset}>
                  Try Again
                </Button>,
              ]}
            />

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  Error Details (Development Only)
                </h3>
                <details className="text-xs text-red-600 dark:text-red-400">
                  <summary className="cursor-pointer font-mono">Stack Trace</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-all">{this.state.error.stack}</pre>
                </details>

                {this.state.errorInfo && (
                  <details className="text-xs text-red-600 dark:text-red-400 mt-2">
                    <summary className="cursor-pointer font-mono">Component Stack</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <SentryErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </SentryErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default SentryErrorBoundary;
