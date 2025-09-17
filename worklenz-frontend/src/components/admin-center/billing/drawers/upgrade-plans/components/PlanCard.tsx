import { Card, Typography, Button } from '@/shared/antd-imports';
import { PlanCardProps } from '../types';
import { IPaddlePlans } from '@/shared/constants';
import { PlanRibbon } from './PlanRibbon';

export const PlanCard: React.FC<PlanCardProps> = ({
  planType,
  title,
  description,
  features,
  priceDisplay,
  selectedPlanType,
  onPlanSelect,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled,
  primaryActionLoading,
  footerNote,
  isAppSumoUser,
  themeMode,
  teamSize,
  billingFrequency,
  calculateTotalCostForPlan,
}) => (
  <Card
    style={{
      height: '100%',
      border: selectedPlanType === planType ? '2px solid #1890ff' : '1px solid #d9d9d9',
      padding: '8px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'visible',
    }}
    bodyStyle={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}
    onClick={() => onPlanSelect(planType)}
    hoverable
  >
    <PlanRibbon
      isSelected={selectedPlanType === planType}
      planType={planType}
      isAppSumoUser={isAppSumoUser}
      themeMode={themeMode}
      teamSize={teamSize}
      billingFrequency={billingFrequency}
      calculateTotalCostForPlan={calculateTotalCostForPlan}
    />
    <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative' }}>
      <Typography.Title level={4} style={{ marginBottom: 8 }}>
        {title}
      </Typography.Title>
      <Typography.Text type="secondary">{description}</Typography.Text>
    </div>

    {priceDisplay}

    <div style={{ marginTop: 16, marginBottom: 24 }}>
      {footerNote && (
        <Typography.Text
          type="secondary"
          style={{ display: 'block', textAlign: 'center', marginBottom: 12 }}
        >
          {footerNote}
        </Typography.Text>
      )}
      <Button
        type="primary"
        block
        onClick={(e) => {
          e.stopPropagation();
          onPrimaryAction();
        }}
        disabled={primaryActionDisabled}
        loading={primaryActionLoading}
      >
        {primaryActionLabel}
      </Button>
    </div>

    <div style={{ flex: 1 }}>{features}</div>
  </Card>
);