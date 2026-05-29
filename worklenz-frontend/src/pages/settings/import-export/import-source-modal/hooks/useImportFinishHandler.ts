import React from 'react';
import { message } from '@/shared/antd-imports';
import {
  commitImportJob,
  ingestImportJob,
  saveImportFields,
  saveImportUserMappings,
  saveImportValueMappings,
  updateImportSource,
} from '@/api/imports';
import type { ImportJob } from '@/api/imports';
import { createAndAttachTargetProject, ensureFieldMappingsAreSaved } from '../import-finish-utils';
import { enqueuePendingImportJob } from '@/components/imports/ImportProgressNotifier';

interface UseImportFinishHandlerArgs {
  integrationType: 'direct' | 'csv';
  lowerKey: string;
  isJira: boolean;
  job: ImportJob | null;
  setJob: React.Dispatch<React.SetStateAction<ImportJob | null>>;
  setIsImporting: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCompletion: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  tt: (key: string, defaultValue: string, options?: Record<string, unknown>) => string;
  spaceName: string;
  spaceType: string;
  spaceTemplate: string;
  selectedProject: string;
  selectedWorkspace: string;
  asanaProjects: Array<{ id: string; name: string; workspaceId?: string }>;
  persistAsanaSelection: (projectId: string, workspaceId?: string, projectName?: string) => Promise<void>;
  fieldMappingRows: Array<{ source_field: string; target_field: string; required?: boolean; include?: boolean }>;
  hierarchyRows: Array<{ source_level: string; target_level: string; position?: number }>;
  runAutoMapping: (suppressToast?: boolean) => Promise<void>;
  selectedJiraProject: string;
  jiraProjects: Array<{ key: string; name: string }>;
  selectedTrelloBoard: string;
  trelloBoards: Array<{ id: string; name: string }>;
  trelloKey: string;
  trelloToken: string;
  selectedBoard: string;
  mondayBoards: Array<{ id: string; name: string }>;
  mondayToken: string;
  csvText: string;
  addUsers: boolean;
  csvColumns: string[];
  includeInImport: Record<string, boolean>;
  fieldMappings: Record<string, string>;
  statusValueMapping: Record<string, string>;
  csvUserRows: string[];
  userEmails: Record<string, string>;
  ensureImportJob: () => Promise<ImportJob>;
  ensureDefaultProjectStatusId: () => Promise<string>;
  persistImportOptions: (
    jobId: string,
    overrides?: { importMembers?: boolean; importAttachments?: boolean }
  ) => Promise<void>;
}

export const useImportFinishHandler = ({
  integrationType,
  lowerKey,
  isJira,
  job,
  setJob,
  setIsImporting,
  setShowCompletion,
  onClose,
  t,
  tt,
  spaceName,
  spaceType,
  spaceTemplate,
  selectedProject,
  selectedWorkspace,
  asanaProjects,
  persistAsanaSelection,
  fieldMappingRows,
  hierarchyRows,
  runAutoMapping,
  selectedJiraProject,
  jiraProjects,
  selectedTrelloBoard,
  trelloBoards,
  trelloKey,
  trelloToken,
  selectedBoard,
  mondayBoards,
  mondayToken,
  csvText,
  addUsers,
  csvColumns,
  includeInImport,
  fieldMappings,
  statusValueMapping,
  csvUserRows,
  userEmails,
  ensureImportJob,
  ensureDefaultProjectStatusId,
  persistImportOptions,
}: UseImportFinishHandlerArgs) =>
  React.useCallback(async () => {
    if (integrationType === 'direct') {
      if (!spaceName.trim()) {
        message.error(t('importStep.projectNameRequired', { defaultValue: 'Please enter a project name.' }));
        return;
      }

      if (lowerKey === 'asana') {
        if (!selectedProject) {
          message.error(t('importStep.projectPlaceholder', 'Select a project'));
          return;
        }
        if (!job?.id) {
          message.error(t('importStep.importError', 'Import failed. Please try again.'));
          return;
        }

        setIsImporting(true);
        try {
          await createAndAttachTargetProject({
            jobId: job.id,
            spaceName,
            spaceType,
            spaceTemplate,
            ensureDefaultProjectStatusId,
            persistImportOptions,
            t: tt,
          });

          const projectName = asanaProjects.find(p => p.id === selectedProject)?.name;
          await persistAsanaSelection(selectedProject, selectedWorkspace, projectName);

          await ensureFieldMappingsAreSaved({
            jobId: job.id,
            fieldMappingRows,
            hierarchyRows,
            runAutoMapping,
          });

          const asanaToken = (job as any)?.source_reference?.auth?.asana?.access_token;

          await ingestImportJob(job.id, {
            sourceReference: {
              provider: lowerKey,
              token: asanaToken,
              projectId: selectedProject,
              workspaceId: selectedWorkspace,
              projectName,
            },
          });

          const commitProgress = await commitImportJob(job.id);
          if (commitProgress?.job) setJob(commitProgress.job as ImportJob);
          enqueuePendingImportJob(job.id);

          setShowCompletion(false);
          message.success(t('importStep.importStarted', 'Import started. We will notify once ready.'));
          onClose();
        } catch (err: any) {
          message.error(err?.response?.data?.message || err?.message || t('importStep.importError', 'Import failed. Please try again.'));
        } finally {
          setIsImporting(false);
        }

        return;
      }

      if (isJira) {
        if (!selectedJiraProject) {
          message.error(t('importStep.jiraProjectRequired', 'Please select a JIRA project'));
          return;
        }
        if (!job?.id) {
          message.error(t('importStep.importError', 'Import failed. Please try again.'));
          return;
        }

        setIsImporting(true);
        try {
          await createAndAttachTargetProject({
            jobId: job.id,
            spaceName,
            spaceType,
            spaceTemplate,
            ensureDefaultProjectStatusId,
            persistImportOptions,
            t: tt,
          });

          const projectName = jiraProjects.find(p => p.key === selectedJiraProject)?.name;
          await updateImportSource(job.id, {
            projectKey: selectedJiraProject,
            projectId: selectedJiraProject,
            projectName,
          });

          await ensureFieldMappingsAreSaved({
            jobId: job.id,
            fieldMappingRows,
            hierarchyRows,
            runAutoMapping,
          });

          const jiraAuth = (job as any)?.source_reference?.auth?.jira;

          await ingestImportJob(job.id, {
            sourceReference: {
              provider: lowerKey,
              token: jiraAuth?.api_token,
              email: jiraAuth?.email,
              domain: jiraAuth?.domain,
              projectKey: selectedJiraProject,
              projectName,
            },
          });

          const commitProgress = await commitImportJob(job.id);
          if (commitProgress?.job) setJob(commitProgress.job as ImportJob);
          enqueuePendingImportJob(job.id);

          setShowCompletion(false);
          message.success(t('importStep.importStarted', 'Import started. We will notify once ready.'));
          onClose();
        } catch (err: any) {
          message.error(err?.response?.data?.message || err?.message || t('importStep.importError', 'Import failed. Please try again.'));
        } finally {
          setIsImporting(false);
        }

        return;
      }

      if (lowerKey === 'trello') {
        if (!selectedTrelloBoard) {
          message.error(
            t('importStep.trelloBoardRequired', 'Please select a Trello board before importing.')
          );
          return;
        }
        if (!job?.id) {
          message.error(t('importStep.importError', 'Import failed. Please try again.'));
          return;
        }

        setIsImporting(true);
        try {
          await createAndAttachTargetProject({
            jobId: job.id,
            spaceName,
            spaceType,
            spaceTemplate,
            ensureDefaultProjectStatusId,
            persistImportOptions,
            t: tt,
          });

          const boardName = trelloBoards.find(b => b.id === selectedTrelloBoard)?.name || null;
          await updateImportSource(job.id, {
            boardId: selectedTrelloBoard,
            boardName,
          });

          await ensureFieldMappingsAreSaved({
            jobId: job.id,
            fieldMappingRows,
            hierarchyRows,
            runAutoMapping,
          });

          const trelloAuth = (job as any)?.source_reference?.auth?.trello || {};
          const resolvedKey = trelloKey.trim() || trelloAuth?.key;
          const resolvedToken = trelloToken.trim() || trelloAuth?.token || trelloAuth?.access_token;

          if (!resolvedKey || !resolvedToken) {
            throw new Error(
              t(
                'importStep.trelloCredentialsMissing',
                'Missing Trello credentials. Please reconnect and try again.'
              )
            );
          }

          await ingestImportJob(job.id, {
            sourceReference: {
              provider: lowerKey,
              key: resolvedKey,
              token: resolvedToken,
              boardId: selectedTrelloBoard,
              boardName,
            },
          });

          const commitProgress = await commitImportJob(job.id);
          if (commitProgress?.job) setJob(commitProgress.job as ImportJob);
          enqueuePendingImportJob(job.id);

          setShowCompletion(false);
          message.success(t('importStep.importStarted', 'Import started. We will notify once ready.'));
          onClose();
        } catch (err: any) {
          message.error(err?.response?.data?.message || err?.message || t('importStep.importError', 'Import failed. Please try again.'));
        } finally {
          setIsImporting(false);
        }

        return;
      }

      if (lowerKey === 'monday') {
        if (!selectedBoard) {
          message.error(
            t('importStep.mondayBoardRequired', 'Please select a Monday board before importing.')
          );
          return;
        }
        if (!job?.id) {
          message.error(t('importStep.importError', 'Import failed. Please try again.'));
          return;
        }

        setIsImporting(true);
        try {
          await createAndAttachTargetProject({
            jobId: job.id,
            spaceName,
            spaceType,
            spaceTemplate,
            ensureDefaultProjectStatusId,
            persistImportOptions,
            t: tt,
          });

          const boardName = mondayBoards.find(b => b.id === selectedBoard)?.name || null;
          await updateImportSource(job.id, {
            projectId: selectedBoard,
            boardId: selectedBoard,
            boardName,
          });

          await ensureFieldMappingsAreSaved({
            jobId: job.id,
            fieldMappingRows,
            hierarchyRows,
            runAutoMapping,
          });

          const mondayAuth = (job as any)?.source_reference?.auth?.monday || {};
          const resolvedToken = mondayToken.trim() || mondayAuth?.token;

          if (!resolvedToken) {
            throw new Error(
              t(
                'importStep.mondayCredentialsMissing',
                'Missing Monday credentials. Please reconnect and try again.'
              )
            );
          }

          await ingestImportJob(job.id, {
            sourceReference: {
              provider: lowerKey,
              token: resolvedToken,
              projectId: selectedBoard,
              boardId: selectedBoard,
              boardName,
            },
          });

          const commitProgress = await commitImportJob(job.id);
          if (commitProgress?.job) setJob(commitProgress.job as ImportJob);
          enqueuePendingImportJob(job.id);

          setShowCompletion(false);
          message.success(t('importStep.importStarted', 'Import started. We will notify once ready.'));
          onClose();
        } catch (err: any) {
          message.error(err?.response?.data?.message || err?.message || t('importStep.importError', 'Import failed. Please try again.'));
        } finally {
          setIsImporting(false);
        }

        return;
      }

      setShowCompletion(false);
      onClose();
      return;
    }

    if (!csvText.trim()) {
      message.error(t('importStep.csvMissing', 'Please upload a CSV file before importing.'));
      return;
    }

    if (!spaceName.trim()) {
      message.error(t('importStep.projectNameRequired', { defaultValue: 'Please enter a project name.' }));
      return;
    }

    setIsImporting(true);
    try {
      const activeJob = await ensureImportJob();
      await createAndAttachTargetProject({
        jobId: activeJob.id,
        spaceName,
        spaceType,
        spaceTemplate,
        ensureDefaultProjectStatusId,
        persistImportOptions,
        t: tt,
        importOptionOverrides: { importMembers: addUsers },
      });

      // Build all mappings upfront and send them with the ingest call so the
      // background worker has everything it needs without a race condition.
      const mappedFields = csvColumns
        .filter(col => includeInImport[col] !== false && fieldMappings[col])
        .map(col => ({
          source_field: col,
          target_field: fieldMappings[col],
          include: includeInImport[col] !== false,
        }));

      const mappedValues = Object.entries(statusValueMapping)
        .filter(([, target]) => !!target)
        .map(([sourceValue, targetWorktype]) => ({
          source_value: sourceValue,
          target_worktype: targetWorktype,
          include: true,
        }));

      const userMappings = csvUserRows.map(user => {
        const candidateEmail = (userEmails[user] || '').trim();
        const hasEmail = !!candidateEmail && candidateEmail.includes('@');
        return {
          source_user_id: user,
          source_email: hasEmail ? candidateEmail : null,
          target_user_id: null,
          resolution: hasEmail ? 'pending' : 'unresolved',
          include: addUsers && hasEmail,
        };
      });

      // Single request — server stores everything in source_reference and marks
      // the job ready; the background worker parses + stages + commits.
      await ingestImportJob(activeJob.id, {
        csvText,
        sourceReference: { provider: lowerKey },
        ...(mappedFields.length ? { fields: mappedFields } : {}),
        ...(mappedValues.length ? { values: mappedValues } : {}),
        ...(userMappings.length ? { users: userMappings } : {}),
      });

      enqueuePendingImportJob(activeJob.id);

      setShowCompletion(false);
      message.success(t('importStep.importStarted', 'Import started. We will notify once ready.'));
      onClose();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.message || err?.message || t('importStep.importError', 'Import failed. Please try again.');
      message.error(errorMessage);
    } finally {
      setIsImporting(false);
    }
  }, [
    addUsers,
    asanaProjects,
    csvColumns,
    csvText,
    csvUserRows,
    ensureDefaultProjectStatusId,
    ensureImportJob,
    fieldMappingRows,
    fieldMappings,
    hierarchyRows,
    includeInImport,
    integrationType,
    isJira,
    job,
    jiraProjects,
    lowerKey,
    mondayBoards,
    mondayToken,
    onClose,
    persistAsanaSelection,
    persistImportOptions,
    runAutoMapping,
    selectedBoard,
    selectedJiraProject,
    selectedProject,
    selectedTrelloBoard,
    selectedWorkspace,
    setIsImporting,
    setJob,
    setShowCompletion,
    spaceName,
    spaceTemplate,
    spaceType,
    t,
    trelloBoards,
    trelloKey,
    trelloToken,
    tt,
    userEmails,
    statusValueMapping,
  ]);
