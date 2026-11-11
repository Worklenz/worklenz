import { createContext } from 'react';
import type { ReactNode } from 'react';

export interface ReportHeaderFilterContextValue {
  isExpanded: boolean;
  setExpanded: (expanded: boolean) => void;
  actions: ReactNode;
}

export const ReportHeaderFilterContext = createContext<ReportHeaderFilterContextValue | null>(null);
