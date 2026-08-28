import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Flex,
  Tag,
  Typography,
  theme,
  CrownOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

const { useToken } = theme;
const { Title, Paragraph, Text } = Typography;

export const useUpgradeMaskBackground = () => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  return themeMode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.12)';
};

interface UpgradeOverlayCardProps {
  title: string;
  description: string;
  features: string[];
  ctaLabel?: string;
  showCta?: boolean;
  comingSoon?: boolean;
}

// The centered "crown icon + title + description + feature checklist +
// Upgrade Now" card used on every gated blurred preview. Exported on its own
// so callers that already render real (blurred) content can drop just the
// overlay on top, instead of going through FeatureUpgradePreview's own
// blur-a-mockup wrapper.
export const UpgradeOverlayCard: React.FC<UpgradeOverlayCardProps> = ({
  title,
  description,
  features,
  ctaLabel,
  showCta = true,
  comingSoon = false,
}) => {
  const dispatch = useAppDispatch();
  const { token } = useToken();
  const { t } = useTranslation('upgrade-preview');
  const resolvedCtaLabel = ctaLabel ?? t('upgradeNowButton', { defaultValue: 'Upgrade Now' });

  return (
    <Card
      style={{
        maxWidth: 380,
        width: '100%',
        textAlign: 'center',
        boxShadow: token.boxShadowSecondary,
      }}
      styles={{ body: { padding: 28 } }}
    >
      <Flex vertical align="center" gap={16}>
        <Flex
          align="center"
          justify="center"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(250, 173, 20, 0.15)',
          }}
        >
          <CrownOutlined style={{ fontSize: 22, color: '#faad14' }} />
        </Flex>

        <div>
          {comingSoon && (
            <Tag
              icon={<ClockCircleOutlined />}
              style={{
                marginBottom: 10,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                background: 'rgba(250, 173, 20, 0.15)',
                borderColor: 'rgba(250, 173, 20, 0.35)',
                color: '#d46b08',
              }}
            >
              {t('comingSoonTag', { defaultValue: 'Coming Soon' })}
            </Tag>
          )}
          <Title level={4} style={{ marginBottom: 4 }}>
            {title}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {description}
          </Paragraph>
        </div>

        <Flex vertical gap={8} align="flex-start" style={{ width: '100%' }}>
          {features.map(feature => (
            <Flex key={feature} gap={8} align="flex-start">
              <CheckCircleFilled style={{ color: '#52c41a', marginTop: 3, flexShrink: 0 }} />
              <Text style={{ textAlign: 'left' }}>{feature}</Text>
            </Flex>
          ))}
        </Flex>

        {showCta && (
          <Button type="primary" size="large" block onClick={() => dispatch(toggleUpgradeModal())}>
            {resolvedCtaLabel}
          </Button>
        )}
      </Flex>
    </Card>
  );
};

interface FeatureUpgradePreviewProps {
  title: string;
  description: string;
  features: string[];
  ctaLabel?: string;
  showCta?: boolean;
  mockup: React.ReactNode;
}

// Renders a non-interactive, blurred preview of a section's real UI with a
// centered upgrade card on top — used in place of the section's routed
// content for users without business-plan access, instead of redirecting
// them away entirely.
const FeatureUpgradePreview: React.FC<FeatureUpgradePreviewProps> = ({
  title,
  description,
  features,
  ctaLabel,
  showCta = true,
  mockup,
}) => {
  const maskBackground = useUpgradeMaskBackground();

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 480 }}>
      <div
        aria-hidden
        style={{
          height: '100%',
          filter: 'blur(2px)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {mockup}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: maskBackground,
          padding: 24,
        }}
      >
        <UpgradeOverlayCard
          title={title}
          description={description}
          features={features}
          ctaLabel={ctaLabel}
          showCta={showCta}
          comingSoon={!showCta}
        />
      </div>
    </div>
  );
};

export default FeatureUpgradePreview;
