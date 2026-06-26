import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Result,
  Button,
  Descriptions,
  Alert,
  Space,
  Typography,
  Spin,
  Steps,
  Card,
  Divider,
  Tag,
  Progress,
} from '@/shared/antd-imports';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  CreditCardOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { PricingCalculation, UserPersonalization } from './PricingModal';
import {
  IPaddleCheckoutParams,
  IUpgradeSubscriptionPlanResponse,
} from '@/types/admin-center/admin-center.types';

interface CheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (subscriptionId: string) => void;
  onError?: (error: string) => void;
  calculation: PricingCalculation | null;
  userPersonalization?: UserPersonalization;
  organizationId?: string;
}

interface CheckoutState {
  step: 'confirmation' | 'processing' | 'success' | 'error';
  subscriptionId?: string;
  errorMessage?: string;
  paddleCheckout?: any;
  progress: number;
}

// Paddle.js integration service
class PaddleService {
  private static instance: PaddleService;
  private paddle: any = null;
  private initialized = false;

  static getInstance(): PaddleService {
    if (!PaddleService.instance) {
      PaddleService.instance = new PaddleService();
    }
    return PaddleService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      // Load Paddle.js if not already loaded
      if (!(window as any).Paddle) {
        const script = document.createElement('script');
        script.src = 'https://cdn.paddle.com/paddle/paddle.js';
        script.onload = () => {
          this.setupPaddle();
          resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Paddle.js'));
        document.head.appendChild(script);
      } else {
        this.setupPaddle();
        resolve();
      }
    });
  }

  private setupPaddle(): void {
    const vendorId = process.env.REACT_APP_PADDLE_VENDOR_ID;
    const environment = process.env.REACT_APP_PADDLE_ENVIRONMENT || 'sandbox';

    if (!vendorId) {
      throw new Error('Paddle vendor ID not configured');
    }

    (window as any).Paddle.Setup({
      vendor: parseInt(vendorId),
      eventCallback: this.handlePaddleEvent.bind(this),
    });

    if (environment === 'sandbox') {
      (window as any).Paddle.Environment.set('sandbox');
    }

    this.paddle = (window as any).Paddle;
    this.initialized = true;
  }

  private handlePaddleEvent(data: any): void {
    console.log('Paddle event:', data);

    // Handle events globally if needed
    switch (data.event) {
      case 'Checkout.Close':
        console.log('Checkout closed');
        break;
      case 'Checkout.Complete':
        console.log('Checkout completed:', data);
        break;
      case 'Checkout.Error':
        console.error('Checkout error:', data);
        break;
    }
  }

  async openCheckout(
    params: IPaddleCheckoutParams,
    callbacks: {
      onSuccess?: (data: any) => void;
      onError?: (error: any) => void;
      onClose?: () => void;
    }
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const checkoutParams = {
      ...params,
      successCallback: callbacks.onSuccess,
      closeCallback: callbacks.onClose,
      errorCallback: callbacks.onError,
    };

    this.paddle.Checkout.open(checkoutParams);
  }

  isAvailable(): boolean {
    return this.initialized && this.paddle;
  }
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onError,
  calculation,
  userPersonalization,
  organizationId,
}) => {
  const { t } = useTranslation(['pricing', 'common']);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({
    step: 'confirmation',
    progress: 0,
  });

  const paddleService = PaddleService.getInstance();

  // Initialize Paddle when modal opens
  useEffect(() => {
    if (visible) {
      paddleService.initialize().catch(error => {
        console.error('Failed to initialize Paddle:', error);
        setCheckoutState(prev => ({
          ...prev,
          step: 'error',
          errorMessage: 'Payment system unavailable. Please try again later.',
        }));
      });
    }
  }, [visible]);

  // Get checkout parameters from backend
  const getCheckoutParams = useCallback(async (): Promise<IUpgradeSubscriptionPlanResponse> => {
    if (!calculation || !organizationId) {
      throw new Error('Missing required checkout information');
    }

    const response = await fetch('/api/subscriptions/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: calculation.planId,
        billingCycle: calculation.cycle.toLowerCase(),
        userCount: calculation.teamSize,
        organizationId,
        pricingModel: calculation.model.toLowerCase(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to prepare checkout');
    }

    return response.json();
  }, [calculation, organizationId]);

  // Handle checkout initiation
  const handleCheckout = useCallback(async () => {
    if (!calculation) return;

    setCheckoutState(prev => ({ ...prev, step: 'processing', progress: 20 }));

    try {
      // Step 1: Get checkout parameters
      setCheckoutState(prev => ({ ...prev, progress: 40 }));
      const checkoutData = await getCheckoutParams();

      // Step 2: Open Paddle checkout
      setCheckoutState(prev => ({ ...prev, progress: 60 }));

      await paddleService.openCheckout(checkoutData.params, {
        onSuccess: data => {
          console.log('Checkout successful:', data);
          setCheckoutState(prev => ({
            ...prev,
            step: 'success',
            subscriptionId: data.checkout?.id || data.order?.id,
            progress: 100,
          }));

          if (onSuccess && data.checkout?.id) {
            onSuccess(data.checkout.id);
          }
        },
        onError: error => {
          console.error('Checkout error:', error);
          setCheckoutState(prev => ({
            ...prev,
            step: 'error',
            errorMessage: error.message || 'Payment failed. Please try again.',
            progress: 0,
          }));

          if (onError) {
            onError(error.message || 'Payment failed');
          }
        },
        onClose: () => {
          // Reset to confirmation if user closes without completing
          if (checkoutState.step === 'processing') {
            setCheckoutState(prev => ({ ...prev, step: 'confirmation', progress: 0 }));
          }
        },
      });

      setCheckoutState(prev => ({ ...prev, progress: 80 }));
    } catch (error) {
      console.error('Checkout preparation failed:', error);
      setCheckoutState(prev => ({
        ...prev,
        step: 'error',
        errorMessage: (error as Error).message,
        progress: 0,
      }));

      if (onError) {
        onError((error as Error).message);
      }
    }
  }, [calculation, getCheckoutParams, paddleService, checkoutState.step, onSuccess, onError]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setCheckoutState({
        step: 'confirmation',
        progress: 0,
      });
    }
  }, [visible]);

  // Render confirmation step
  const renderConfirmation = () => {
    if (!calculation) return null;

    const { planId, totalCost, teamSize, cycle, discountApplied } = calculation;

    return (
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Typography.Title level={3}>Confirm Your Subscription</Typography.Title>
            <Typography.Text type="secondary">
              Review your plan details before proceeding
            </Typography.Text>
          </div>

          <Descriptions title="Subscription Summary" bordered column={1} size="middle">
            <Descriptions.Item label="Plan">
              <Space>
                <Typography.Text strong>{planId.replace('_', ' ').toUpperCase()}</Typography.Text>
                <Tag color="blue">{cycle}</Tag>
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="Team Size">
              {teamSize} {teamSize === 1 ? 'user' : 'users'}
            </Descriptions.Item>

            {discountApplied && (
              <Descriptions.Item label="Discount">
                <Space>
                  <Tag color="red">{discountApplied.percentage}% OFF</Tag>
                  <Typography.Text type="success">
                    Save ${discountApplied.amount.toFixed(2)}
                  </Typography.Text>
                </Space>
              </Descriptions.Item>
            )}

            <Descriptions.Item label="Total">
              <Typography.Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                ${totalCost.toFixed(2)}/month
              </Typography.Title>
            </Descriptions.Item>
          </Descriptions>

          {userPersonalization?.userType === 'appsumo' && (
            <Alert
              message="AppSumo Special Pricing"
              description="You're getting 50% off for the first 12 months. This is a limited-time offer!"
              type="success"
              showIcon
              icon={<RocketOutlined />}
            />
          )}

          <Alert
            message="Secure Checkout"
            description="Your payment will be processed securely through Paddle. You can cancel or change your plan anytime."
            type="info"
            showIcon
            icon={<SafetyCertificateOutlined />}
          />

          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button size="large" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<CreditCardOutlined />}
              onClick={handleCheckout}
            >
              Proceed to Payment
            </Button>
          </Space>
        </Space>
      </Card>
    );
  };

  // Render processing step
  const renderProcessing = () => (
    <Card style={{ textAlign: 'center' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />

        <Typography.Title level={3}>Processing Your Subscription</Typography.Title>

        <Progress percent={checkoutState.progress} strokeColor="#1890ff" trailColor="#f0f0f0" />

        <Typography.Text type="secondary">
          Please wait while we set up your subscription...
        </Typography.Text>

        <Alert
          message="Do not close this window"
          description="Your payment is being processed. Closing this window may interrupt the process."
          type="warning"
          showIcon
        />
      </Space>
    </Card>
  );

  // Render success step
  const renderSuccess = () => (
    <Result
      status="success"
      title="Subscription Created Successfully!"
      subTitle={
        checkoutState.subscriptionId
          ? `Your subscription ID is ${checkoutState.subscriptionId}. You'll receive a confirmation email shortly.`
          : "Your subscription has been activated. You'll receive a confirmation email shortly."
      }
      extra={[
        <Button type="primary" key="dashboard" onClick={onClose}>
          Go to Dashboard
        </Button>,
        <Button key="billing" onClick={() => window.open('/admin-center/billing', '_blank')}>
          View Billing
        </Button>,
      ]}
    />
  );

  // Render error step
  const renderError = () => (
    <Result
      status="error"
      title="Subscription Failed"
      subTitle={
        checkoutState.errorMessage || 'Something went wrong during the subscription process.'
      }
      extra={[
        <Button
          type="primary"
          key="retry"
          onClick={() => setCheckoutState(prev => ({ ...prev, step: 'confirmation' }))}
        >
          Try Again
        </Button>,
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
      ]}
    />
  );

  // Render step content
  const renderStepContent = () => {
    switch (checkoutState.step) {
      case 'confirmation':
        return renderConfirmation();
      case 'processing':
        return renderProcessing();
      case 'success':
        return renderSuccess();
      case 'error':
        return renderError();
      default:
        return renderConfirmation();
    }
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      centered
      destroyOnClose
      closable={checkoutState.step !== 'processing'}
      maskClosable={checkoutState.step !== 'processing'}
    >
      <div style={{ padding: '20px 0' }}>
        {/* Progress Steps */}
        <Steps
          current={
            checkoutState.step === 'confirmation'
              ? 0
              : checkoutState.step === 'processing'
                ? 1
                : checkoutState.step === 'success'
                  ? 2
                  : 1 // error state shows as processing step
          }
          status={checkoutState.step === 'error' ? 'error' : 'process'}
          style={{ marginBottom: 32 }}
        >
          <Steps.Step title="Confirm" icon={<ExclamationCircleOutlined />} />
          <Steps.Step title="Payment" icon={<CreditCardOutlined />} />
          <Steps.Step title="Complete" icon={<CheckCircleOutlined />} />
        </Steps>

        {/* Step Content */}
        {renderStepContent()}
      </div>
    </Modal>
  );
};

export default CheckoutModal;
