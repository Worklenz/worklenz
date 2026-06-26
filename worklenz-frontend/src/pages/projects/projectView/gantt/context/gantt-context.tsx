import React, { createContext, useContext } from 'react';
import { GanttContextType } from '../types/gantt-types';

const GanttContext = createContext<GanttContextType | undefined>(undefined);

export const GanttProvider: React.FC<{
  children: React.ReactNode;
  value: GanttContextType;
}> = ({ children, value }) => {
  return <GanttContext.Provider value={value}>{children}</GanttContext.Provider>;
};

export const useGanttContext = () => {
  const context = useContext(GanttContext);
  if (!context) {
    throw new Error('useGanttContext must be used within a GanttProvider');
  }
  return context;
};
