import type { ReactNode } from 'react';
import { Button, Result, Skeleton } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { errorStatus } from './queryErrors';
import { UnavailableState } from './UnavailableState';

interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch?: () => void;
  /** Where "Back" goes on the unavailable state (a 404 never says whether the item exists). */
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}

/**
 * Every async screen has three states: loading, error with a way to recover, and content.
 * A 404 is shown as "unavailable", never as an error, so the portal doesn't reveal whether an item exists.
 */
export const QueryState = ({ isLoading, isError, error, refetch, onBack, backLabel, children }: QueryStateProps) => {
  const { t } = useTranslation();

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} title />;

  if (isError) {
    if (errorStatus(error) === 404 && onBack) return <UnavailableState onBack={onBack} backLabel={backLabel} />;
    return (
      <Result
        status="error"
        title={t('error.title', { defaultValue: 'Something went wrong' })}
        subTitle={t('error.body', { defaultValue: 'We could not load this. Check your connection and try again.' })}
        extra={
          refetch && (
            <Button type="primary" onClick={refetch}>
              {t('error.retry', { defaultValue: 'Try again' })}
            </Button>
          )
        }
      />
    );
  }

  return <>{children}</>;
};
