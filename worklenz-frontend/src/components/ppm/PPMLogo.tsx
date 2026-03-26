// PPM-OVERRIDE: Custom branding logo for Prestige Pro Media TaskFlow
import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';

interface PPMLogoProps {
  size?: 'small' | 'medium' | 'large';
  showSubtitle?: boolean;
}

const sizeConfig = {
  small: { iconHeight: 20, fontSize: 16, subtitleSize: 10, gap: 2 },
  medium: { iconHeight: 28, fontSize: 22, subtitleSize: 13, gap: 3 },
  large: { iconHeight: 36, fontSize: 28, subtitleSize: 16, gap: 4 },
};

const PPMLogo: React.FC<PPMLogoProps> = ({ size = 'medium', showSubtitle = true }) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const { iconHeight, fontSize, subtitleSize, gap } = sizeConfig[size];
  const iconWidth = Math.round(iconHeight * 0.65);

  const fillColor = isDark ? '#ffffff' : '#171719';
  const subtitleColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(23,23,25,0.6)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* P icon mark — no background */}
        <svg
          width={iconWidth}
          height={iconHeight}
          viewBox="0 0 13 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M9.83268 0H0V19.648L4.47421 12.5322H9.83268C11.4847 12.5322 12.8243 11.0943 12.8243 9.32101V3.2112C12.8243 1.43794 11.4847 0 9.83268 0ZM10.1768 9.57108C10.1768 9.71317 10.0709 9.82684 9.93858 9.82684H2.55215V2.84177H9.93328C10.0657 2.84177 10.1716 2.95544 10.1716 3.09753V9.57108H10.1768Z"
            fill="#0061FF"
          />
        </svg>
        {/* "restige Pro Media" text to complete "Prestige Pro Media" */}
        <span
          style={{
            fontSize,
            fontWeight: 700,
            color: fillColor,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            fontFamily: '"Space Grotesk", sans-serif',
          }}
        >
          restige Pro Media
        </span>
      </div>
      {showSubtitle && (
        <span
          style={{
            fontSize: subtitleSize,
            fontWeight: 500,
            color: subtitleColor,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            lineHeight: 1,
            paddingLeft: iconWidth + 4,
            fontFamily: '"Space Grotesk", sans-serif',
          }}
        >
          TaskFlow
        </span>
      )}
    </div>
  );
};

export default PPMLogo;
