import React from 'react';

interface UpgradePlanButtonProps {
  /** Accepted for interface parity with the EE button; ignored in CE. */
  showModal?: boolean;
  redirectToBilling?: boolean;
}

const PRICING_URL = 'https://worklenz.com/pricing';

/**
 * CE stub — a plain external link to the public pricing page (no in-app Paddle checkout).
 */
const UpgradePlanButton: React.FC<UpgradePlanButtonProps> = () => (
  <a
    href={PRICING_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="upgrade-plan-button"
  >
    Upgrade
  </a>
);

export default UpgradePlanButton;
