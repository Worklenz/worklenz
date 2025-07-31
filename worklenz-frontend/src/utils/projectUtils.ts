import { PROJECT_STATUS_ICON_MAP } from '@/shared/constants';
import React from 'react';

export function getStatusIcon(statusIcon: string, colorCode: string) {
  return React.createElement(
    PROJECT_STATUS_ICON_MAP[statusIcon as keyof typeof PROJECT_STATUS_ICON_MAP],
    {
      style: { fontSize: 16, color: colorCode },
    }
  );
}
