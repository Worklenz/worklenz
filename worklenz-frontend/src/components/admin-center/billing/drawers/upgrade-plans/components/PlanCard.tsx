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
    className="upgrade-plan-card"
    style={{
      height: '100%',
      border: selectedPlanType === planType ? '2px solid #1890ff' : '1px solid #d9d9d9',
      padding: '4px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'visible',
    }}
    styles={{
      body: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '12px',
      },
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
    <div className="upgrade-plan-card__header" style={{ textAlign: 'center', position: 'relative' }}>
      <Typography.Title level={4} style={{ marginBottom: 4 }}>
        {title}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
        {description}
      </Typography.Text>
    </div>

    <div className="upgrade-plan-card__price">{priceDisplay}</div>

    <div className="upgrade-plan-card__action">
      {footerNote && (
        <Typography.Text
          type="secondary"
          style={{ display: 'block', textAlign: 'center', marginBottom: 8, fontSize: '12px' }}
        >
          {footerNote}
        </Typography.Text>
      )}
      <Button
        type="primary"
        block
        size="middle"
        onClick={e => {
          e.stopPropagation();
          onPrimaryAction();
        }}
        disabled={primaryActionDisabled}
        loading={primaryActionLoading}
      >
        {primaryActionLabel}
      </Button>
    </div>

    <div className="upgrade-plan-card__features">{features}</div>
  </Card>
);
