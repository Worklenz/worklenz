import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useClientAccess } from '@/hooks/useClientAccess';
import { UnavailableState } from './UnavailableState';

/**
 * Invoices exist for a client only when the operator turned them on. A typed URL gets the same
 * "unavailable" page as any other hidden item, and never says whether invoices exist.
 */
export const InvoicesGate = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { isLoading, invoicesVisible } = useClientAccess();
  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (!invoicesVisible) return <UnavailableState onBack={() => navigate('/dashboard')} />;
  return <>{children}</>;
};
