import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetDashboardV2Query } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { EmptyState, PageHeader, QueryState } from '@/components/v2';
import { DashboardContent } from '@/features/dashboard/DashboardContent';

/**
 * Action-oriented summary of every project the signed-in client can open (spec #2526). The page body
 * is a widget grid the client can rearrange, resize, hide and configure (see features/dashboard).
 */
export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const query = useGetDashboardV2Query();
  const { me } = useClientAccess();
  const firstName = me?.name.split(' ')[0] ?? '';

  return (
    <QueryState {...query} refetch={query.refetch}>
      {query.data && query.data.projects.length === 0 ? (
        <>
          <PageHeader
            title={t('dashboard.title', { defaultValue: 'Overview' })}
            subtitle={t('dashboard.welcomeName', { name: firstName, defaultValue: 'Welcome, {{name}}.' })}
          />
          <EmptyState
            title={t('dashboard.noProjects', { defaultValue: 'No projects are shared with you yet' })}
            description={t('dashboard.noProjectsHelp', {
              defaultValue:
                'When your project contact assigns you to a project, it appears here. Nothing from their workspace is shown until then.',
            })}
          />
        </>
      ) : (
        query.data && <DashboardContent data={query.data} firstName={firstName} />
      )}
    </QueryState>
  );
};

export default DashboardPage;
