import React from 'react';
import { message as antdMessage } from '@/shared/antd-imports';
import ImportSourceModal from '@/pages/settings/import-export/ImportSourceModal';
import { AVAILABLE_IMPORT_SOURCES } from '@/pages/settings/import-export/import-source-modal/source-icons';
import { registerImportCompletionListener } from '@/components/imports/ImportProgressNotifier';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchTasksV3, setLoading } from '@/features/task-management/task-management.slice';
import { fetchTaskListColumns } from '@/features/tasks/tasks.slice';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';

// CSV is the only source that makes sense here: it's the only flow that
// imports rows directly into an *existing* project's task list without any
// external auth. The other providers (Asana/Jira/Trello/Monday) are for
// migrating a whole external project and are only reachable from Settings.
const CSV_SOURCE = AVAILABLE_IMPORT_SOURCES.find(source => source.key === 'csv') || null;

interface ProjectImportModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
}

export const ProjectImportModal: React.FC<ProjectImportModalProps> = ({
  open,
  onClose,
  projectId,
  projectName,
}) => {
  const dispatch = useAppDispatch();

  const createTargetProject = React.useCallback(async () => projectId, [projectId]);

  const handleImportStarted = React.useCallback(
    (targetProjectId: string, jobId: string) => {
      // Ingestion runs on a background worker, so the tasks aren't there yet —
      // wait for the job to actually finish before refreshing the task list.
      registerImportCompletionListener(jobId, status => {
        if (status !== 'success' || targetProjectId !== projectId) return;

        dispatch(setLoading(true));
        Promise.allSettled([
          dispatch(fetchStatuses(projectId)).unwrap(),
          dispatch(fetchTaskListColumns(projectId)).unwrap(),
          dispatch(fetchPhasesByProjectId(projectId)).unwrap(),
          dispatch(fetchTasksV3(projectId)).unwrap(),
        ]).finally(() => dispatch(setLoading(false)));

        antdMessage.success('Imported tasks are now in the task list.');
      });
    },
    [dispatch, projectId]
  );

  if (!projectId) return null;

  return (
    <ImportSourceModal
      open={open}
      onClose={onClose}
      source={CSV_SOURCE}
      createTargetProject={createTargetProject}
      initialProjectName={projectName}
      hideProjectSetup
      onImportStarted={handleImportStarted}
    />
  );
};

export default ProjectImportModal;
