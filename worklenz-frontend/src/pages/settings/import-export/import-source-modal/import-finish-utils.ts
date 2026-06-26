import { saveImportFields, updateImportTarget } from '@/api/imports';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

interface CreateAndAttachTargetProjectArgs {
  jobId: string;
  spaceName: string;
  spaceType: string;
  spaceTemplate: string;
  ensureDefaultProjectStatusId: () => Promise<string>;
  persistImportOptions: (
    jobId: string,
    overrides?: { importMembers?: boolean; importAttachments?: boolean }
  ) => Promise<void>;
  t: (key: string, defaultValue: string) => string;
  importOptionOverrides?: { importMembers?: boolean; importAttachments?: boolean };
}

interface EnsureFieldMappingsArgs {
  jobId: string;
  fieldMappingRows: Array<{ source_field: string; target_field: string; required?: boolean; include?: boolean }>;
  hierarchyRows: Array<{ source_level: string; target_level: string; position?: number }>;
  runAutoMapping: (suppressToast?: boolean) => Promise<void>;
}

const buildProjectPayload = (name: string, statusId: string): IProjectViewModel => ({
  name,
  color_code: '#2563eb',
  status_id: statusId,
  category_id: null,
  health_id: null,
  notes: '',
  working_days: 0,
  man_days: 0,
  hours_per_day: 0,
  use_manual_progress: false,
  use_weighted_progress: false,
  use_time_progress: false,
});

export const createAndAttachTargetProject = async ({
  jobId,
  spaceName,
  spaceType,
  spaceTemplate,
  ensureDefaultProjectStatusId,
  persistImportOptions,
  t,
  importOptionOverrides,
}: CreateAndAttachTargetProjectArgs): Promise<string> => {
  const statusId = await ensureDefaultProjectStatusId();
  const projectPayload = buildProjectPayload(spaceName.trim(), statusId);

  const projectResp = await projectsApiService.createProject(projectPayload);
  const projectId = projectResp?.body?.id;
  if (!projectResp?.done || !projectId) {
    throw new Error(
      projectResp?.message || t('importStep.projectCreateError', 'Failed to create project')
    );
  }

  await updateImportTarget(jobId, {
    targetProjectId: projectId,
    targetSpaceType: spaceType,
    targetTemplate: spaceTemplate,
  });
  await persistImportOptions(jobId, importOptionOverrides);

  return projectId;
};

export const ensureFieldMappingsAreSaved = async ({
  jobId,
  fieldMappingRows,
  hierarchyRows,
  runAutoMapping,
}: EnsureFieldMappingsArgs): Promise<void> => {
  if (!fieldMappingRows.length || !hierarchyRows.length) {
    await runAutoMapping(true);
  }

  if (fieldMappingRows.length) {
    await saveImportFields(jobId, fieldMappingRows as any);
  }
};

