import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result } from '@/shared/antd-imports';
import CacheCleanup from '@/utils/cache-cleanup';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ModuleErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a module loading error
    const isModuleError = 
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk') ||
      error.name === 'ChunkLoadError';

    if (isModuleError) {
      return { hasError: true, error };
    }

    // For other errors, let them bubble up
    return { hasError: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Module Error Boundary caught an error:', error, errorInfo);
    
    // If this is a module loading error, clear caches and reload
    if (this.state.hasError) {
      this.handleModuleError();
    }
  }

  private async handleModuleError() {
    try {
      console.log('Handling module loading error - clearing caches...');
      
      // Clear all caches
      await CacheCleanup.clearAllCaches();
      
      // Force reload to login page
      CacheCleanup.forceReload('/auth/login');
    } catch (cacheError) {
      console.error('Failed to handle module error:', cacheError);
      // Fallback: just reload the page
      window.location.reload();
    }
  }

  private handleRetry = async () => {
    try {
      await CacheCleanup.clearAllCaches();
      CacheCleanup.forceReload('/auth/login');
    } catch (error) {
      console.error('Retry failed:', error);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          padding: '20px'
        }}>
          <Result
            status="error"
            title="Module Loading Error"
            subTitle="There was an issue loading the application. This usually happens after updates or during logout."
            extra={[
              <Button 
                type="primary" 
                key="retry" 
                onClick={this.handleRetry}
                loading={false}
              >
                Retry
              </Button>,
              <Button 
                key="reload" 
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ModuleErrorBoundary; 