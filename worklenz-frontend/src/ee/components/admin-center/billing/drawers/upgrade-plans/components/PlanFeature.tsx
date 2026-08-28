import { CheckCircleFilled } from '@/shared/antd-imports';
import { PlanFeatureProps } from '../types';
import { FEATURE_ICON_COLOR } from '../constants';

export const PlanFeature: React.FC<PlanFeatureProps> = ({
  text,
  iconColor = FEATURE_ICON_COLOR,
}) => (
  <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
    <CheckCircleFilled
      style={{ color: iconColor, marginTop: '1px', flexShrink: 0, fontSize: '12px' }}
    />
    <span style={{ lineHeight: '1.3', fontSize: '12px' }}>{text}</span>
  </div>
);
