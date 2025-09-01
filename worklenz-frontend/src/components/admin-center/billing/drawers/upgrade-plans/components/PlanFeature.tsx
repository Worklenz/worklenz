import { CheckCircleFilled } from '@/shared/antd-imports';
import { PlanFeatureProps } from '../types';
import { FEATURE_ICON_COLOR } from '../constants';

export const PlanFeature: React.FC<PlanFeatureProps> = ({ 
  text, 
  iconColor = FEATURE_ICON_COLOR 
}) => (
  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
    <CheckCircleFilled style={{ color: iconColor, marginTop: '2px', flexShrink: 0 }} />
    <span style={{ lineHeight: '1.4' }}>{text}</span>
  </div>
);