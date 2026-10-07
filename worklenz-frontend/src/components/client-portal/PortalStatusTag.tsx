import { Tag } from '@/shared/antd-imports';
import React from 'react';
import type { CSSProperties } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';

export type PortalStatusType = 'active' | 'invited' | 'not_invited' | 'expired';

interface PortalStatusTagProps {
  status: PortalStatusType | string;
  label: string;
}

interface StatusColorSet {
  backgroundColor: string;
  borderColor: string;
  color: string;
}

/** Matches Ant Design preset Tag colors in light mode; dark variants keep the same hue family with readable contrast. */
const PORTAL_STATUS_COLORS: Record<
  PortalStatusType,
  { light: StatusColorSet; dark: StatusColorSet }
> = {
  active: {
    light: { backgroundColor: '#f6ffed', borderColor: '#b7eb8f', color: '#389e0d' },
    dark: { backgroundColor: '#0f1b0f', borderColor: '#274916', color: '#73d13d' },
  },
  expired: {
    light: { backgroundColor: '#fff2f0', borderColor: '#ffccc7', color: '#cf1322' },
    dark: { backgroundColor: '#1f0f0f', borderColor: '#58181c', color: '#ff7875' },
  },
  invited: {
    light: { backgroundColor: '#fff7e6', borderColor: '#ffd591', color: '#d46b08' },
    dark: { backgroundColor: '#2b2111', borderColor: '#594214', color: '#ffc53d' },
  },
  not_invited: {
    light: {
      backgroundColor: '#fafafa',
      borderColor: '#d9d9d9',
      color: 'rgba(0, 0, 0, 0.65)',
    },
    dark: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: '#424242',
      color: 'rgba(255, 255, 255, 0.65)',
    },
  },
};

const getPortalStatusTagStyle = (
  status: PortalStatusType | string,
  isDarkMode: boolean
): CSSProperties => {
  const palette =
    PORTAL_STATUS_COLORS[status as PortalStatusType] ?? PORTAL_STATUS_COLORS.not_invited;
  const colors = isDarkMode ? palette.dark : palette.light;

  return {
    textTransform: 'capitalize',
    margin: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    ...colors,
  };
};

export const PortalStatusTag: React.FC<PortalStatusTagProps> = ({ status, label }) => {
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  return <Tag style={getPortalStatusTagStyle(status, isDarkMode)}>{label}</Tag>;
};

export default PortalStatusTag;
