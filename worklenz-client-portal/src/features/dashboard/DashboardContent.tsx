import { useTranslation } from 'react-i18next';
import { useClientAccess } from '@/hooks/useClientAccess';
import { EmptyState, PageHeader } from '@/components/v2';
import { DashboardGrid } from './DashboardGrid';
import { DashboardToolbar } from './DashboardToolbar';
import { useDashboardLayout } from './useDashboardLayout';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import type { ClientDashboardV2 } from '@/types/v2';

/** The customisable dashboard for a client who has at least one project. */
export const DashboardContent = ({ data, firstName }: { data: ClientDashboardV2; firstName: string }) => {
  const { t } = useTranslation();
  const { me, invoicesVisible } = useClientAccess();
  const layout = useDashboardLayout(me?.id ?? 'anonymous', { invoicesVisible: invoicesVisible && data.unpaid_amount !== undefined });
  useUnsavedChangesGuard(layout.isDirty, layout.cancel);
  const hasVisibleWidgets = layout.widgets.some(widget => !widget.hidden);

  return (
    <div>
      <PageHeader
        title={t('dashboard.title', { defaultValue: 'Overview' })}
        subtitle={t('dashboard.welcomeBack', {
          name: firstName,
          defaultValue: 'Welcome back, {{name}}. Here is where your projects stand.',
        })}
        extra={<DashboardToolbar layout={layout} />}
      />
      {hasVisibleWidgets ? (
        <DashboardGrid data={data} layout={layout} />
      ) : (
        <EmptyState
          title={t('dashboard.customize.emptyTitle', { defaultValue: 'Your overview has no widgets' })}
          description={t('dashboard.customize.emptyHelp', { defaultValue: 'Choose Customise, then Add widget to bring some back.' })}
        />
      )}
    </div>
  );
};
