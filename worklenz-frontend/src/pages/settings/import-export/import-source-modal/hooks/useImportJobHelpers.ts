import React from 'react';
import { createImportJob, updateImportSource } from '@/api/imports';
import type { ImportJob } from '@/api/imports';
import { projectsApiService } from '@/api/projects/projects.api.service';
import type { IProjectStatus } from '@/types/project/projectStatus.types';

interface UseImportJobHelpersArgs {
  integrationType: 'direct' | 'csv';
  providerForApi: string;
  job: ImportJob | null;
  setJob: React.Dispatch<React.SetStateAction<ImportJob | null>>;
  defaultProjectStatusId: string | null;
  setDefaultProjectStatusId: React.Dispatch<React.SetStateAction<string | null>>;
  worklenzStatuses: IProjectStatus[];
  setWorklenzStatuses: React.Dispatch<React.SetStateAction<IProjectStatus[]>>;
  defaultWorkTypes: IProjectStatus[];
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
}

export const useImportJobHelpers = ({
  integrationType,
  providerForApi,
  job,
  setJob,
  defaultProjectStatusId,
  setDefaultProjectStatusId,
  worklenzStatuses,
  setWorklenzStatuses,
  defaultWorkTypes,
  t,
}: UseImportJobHelpersArgs) => {
  const ensureImportJob = React.useCallback(async () => {
    if (job) return job;
    const created = await createImportJob({
      provider: providerForApi,
      flowType: integrationType,
    });
    setJob(created);
    return created;
  }, [integrationType, job, providerForApi, setJob]);

  const ensureDefaultProjectStatusId = React.useCallback(async (): Promise<string> => {
    if (defaultProjectStatusId) return defaultProjectStatusId;

    const pickDefault = (statuses: IProjectStatus[]) =>
      statuses.find(status => status.is_default) || statuses[0];

    if (worklenzStatuses.length) {
      const defaultStatus = pickDefault(worklenzStatuses);
      if (defaultStatus?.id) {
        setDefaultProjectStatusId(defaultStatus.id);
        return defaultStatus.id;
      }
    }

    try {
      const resp = await projectsApiService.getProjectStatuses();
      const statuses = resp?.body || [];
      if (statuses.length) {
        setWorklenzStatuses(statuses);
        const defaultStatus = pickDefault(statuses);
        if (defaultStatus?.id) {
          setDefaultProjectStatusId(defaultStatus.id);
          return defaultStatus.id;
        }
      }
    } catch (error) {
      // ignore and fall back to defaults below
    }

    const fallbackDefault = pickDefault(defaultWorkTypes);
    if (fallbackDefault?.id) {
      setWorklenzStatuses(defaultWorkTypes);
      setDefaultProjectStatusId(fallbackDefault.id);
      return fallbackDefault.id;
    }

    throw new Error(t('importStep.projectStatusMissing', 'No project status available'));
  }, [
    defaultProjectStatusId,
    defaultWorkTypes,
    setDefaultProjectStatusId,
    setWorklenzStatuses,
    t,
    worklenzStatuses,
  ]);

  const persistAsanaSelection = React.useCallback(
    async (projectId: string, workspaceId?: string, projectName?: string) => {
      if (!job?.id) return;
      await updateImportSource(job.id, {
        projectId,
        workspaceId: workspaceId || null,
        projectName: projectName || null,
      });
    },
    [job?.id]
  );

  return {
    ensureImportJob,
    ensureDefaultProjectStatusId,
    persistAsanaSelection,
  };
};

