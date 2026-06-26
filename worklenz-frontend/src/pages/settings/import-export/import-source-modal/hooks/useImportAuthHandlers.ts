import React from 'react';
import { message } from '@/shared/antd-imports';
import {
  clickupWorkspaces,
  getImportJob,
  jiraValidate,
  mondayValidate,
  startAsanaAuth,
  trelloValidate,
  updateImportSource,
} from '@/api/imports';
import type { ImportJob } from '@/api/imports';
import { validateEmail } from '@/utils/validateEmail';
import type { ClickupTeam } from '../types';
import { isValidDomain, normalizeDomain } from '../utils';

interface UseImportAuthHandlersArgs {
  job: ImportJob | null;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  runAutoMapping: (suppressToast?: boolean) => Promise<void>;
  persistAsanaSelection: (projectId: string, workspaceId?: string, projectName?: string) => Promise<void>;

  mondayToken: string;
  trelloKey: string;
  trelloToken: string;
  clickupToken: string;
  jiraEmail: string;
  jiraDomain: string;
  jiraToken: string;

  setJob: React.Dispatch<React.SetStateAction<ImportJob | null>>;
  setAuthLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setAuthError: React.Dispatch<React.SetStateAction<string | null>>;
  setAuthCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  setAsanaWorkspaces: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>;
  setAsanaProjects: React.Dispatch<
    React.SetStateAction<Array<{ id: string; name: string; workspaceId?: string }>>
  >;
  setSelectedWorkspace: React.Dispatch<React.SetStateAction<string>>;
  setSelectedProject: React.Dispatch<React.SetStateAction<string>>;
  setMondayBoards: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>;
  setSelectedBoard: React.Dispatch<React.SetStateAction<string>>;
  setTrelloBoards: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>;
  setSelectedTrelloBoard: React.Dispatch<React.SetStateAction<string>>;
  setClickupTeams: React.Dispatch<React.SetStateAction<ClickupTeam[]>>;
  setSelectedClickupSpace: React.Dispatch<React.SetStateAction<string>>;
  setSelectedClickupList: React.Dispatch<React.SetStateAction<string>>;
  setJiraDomain: React.Dispatch<React.SetStateAction<string>>;
  setJiraProjects: React.Dispatch<React.SetStateAction<Array<{ key: string; name: string }>>>;
  setSelectedJiraProject: React.Dispatch<React.SetStateAction<string>>;
}

export const useImportAuthHandlers = ({
  job,
  t,
  runAutoMapping,
  persistAsanaSelection,
  mondayToken,
  trelloKey,
  trelloToken,
  clickupToken,
  jiraEmail,
  jiraDomain,
  jiraToken,
  setJob,
  setAuthLoading,
  setAuthError,
  setAuthCompleted,
  setAsanaWorkspaces,
  setAsanaProjects,
  setSelectedWorkspace,
  setSelectedProject,
  setMondayBoards,
  setSelectedBoard,
  setTrelloBoards,
  setSelectedTrelloBoard,
  setClickupTeams,
  setSelectedClickupSpace,
  setSelectedClickupList,
  setJiraDomain,
  setJiraProjects,
  setSelectedJiraProject,
}: UseImportAuthHandlersArgs) => {
  const handleAsanaAuth = React.useCallback(async () => {
    if (!job) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { authUrl } = await startAsanaAuth(job.id);
      const popup = window.open(authUrl, '_blank', 'noopener,noreferrer');
      const started = Date.now();
      const poll = setInterval(async () => {
        if (Date.now() - started > 120000) {
          clearInterval(poll);
          setAuthLoading(false);
          setAuthError(t('auth.error', 'Connection failed. Please try again.'));
          return;
        }
        try {
          const refreshed = await getImportJob(job.id);
          const auth = (refreshed as any)?.source_reference?.auth?.asana;
          if (auth?.access_token) {
            clearInterval(poll);
            popup?.close();
            setJob(refreshed as ImportJob);
            setAsanaWorkspaces(auth.workspaces || []);
            setAsanaProjects(auth.projects || []);
            if (auth.workspaces?.[0]?.id) setSelectedWorkspace(auth.workspaces[0].id);
            if (auth.projects?.[0]?.id) {
              const firstProject = auth.projects[0];
              setSelectedProject(firstProject.id);
              await persistAsanaSelection(
                firstProject.id,
                auth.workspaces?.[0]?.id,
                firstProject.name
              );
              await runAutoMapping(true);
            }
            setAuthCompleted(true);
            setAuthLoading(false);
            setAuthError(null);
            message.success(t('auth.success', 'Connected'));
          }
        } catch (error) {
          // swallow and continue polling
        }
      }, 2000);
    } catch (err: any) {
      setAuthError(err?.message || t('auth.error', 'Connection failed. Please try again.'));
      setAuthLoading(false);
    }
  }, [
    job,
    persistAsanaSelection,
    runAutoMapping,
    setAsanaProjects,
    setAsanaWorkspaces,
    setAuthCompleted,
    setAuthError,
    setAuthLoading,
    setJob,
    setSelectedProject,
    setSelectedWorkspace,
    t,
  ]);

  const handleMondayValidate = React.useCallback(async () => {
    if (!mondayToken.trim()) return;
    if (!job) {
      setAuthError(
        t('auth.jobMissing', 'Connection not ready. Please close and reopen the modal.')
      );
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await mondayValidate(job.id, mondayToken.trim());
      setMondayBoards(resp.boards || []);
      setSelectedBoard(resp.boards?.[0]?.id || '');
      setAuthCompleted(true);
      setAuthError(null);
      message.success(t('auth.success', 'Connected'));
    } catch (err: any) {
      setAuthError(err?.message || t('auth.error', 'Connection failed. Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  }, [
    job,
    mondayToken,
    setAuthCompleted,
    setAuthError,
    setAuthLoading,
    setMondayBoards,
    setSelectedBoard,
    t,
  ]);

  const handleTrelloValidate = React.useCallback(async () => {
    if (!job || !trelloKey.trim() || !trelloToken.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await trelloValidate(job.id, {
        key: trelloKey.trim(),
        token: trelloToken.trim(),
      });
      const boards = resp.boards || [];
      setTrelloBoards(boards);
      const firstBoardId = boards?.[0]?.id || '';
      setSelectedTrelloBoard(firstBoardId);
      if (firstBoardId) {
        try {
          await updateImportSource(job.id, {
            boardId: firstBoardId,
            boardName: boards?.[0]?.name || '',
            key: trelloKey.trim(),
            token: trelloToken.trim(),
          });
        } catch (error) {
          // best-effort persistence
        }
      }
      setAuthCompleted(true);
      setAuthError(null);
      message.success(t('auth.success', 'Connected'));
    } catch (err: any) {
      setAuthError(err?.message || t('auth.error', 'Connection failed. Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  }, [
    job,
    setAuthCompleted,
    setAuthError,
    setAuthLoading,
    setSelectedTrelloBoard,
    setTrelloBoards,
    t,
    trelloKey,
    trelloToken,
  ]);

  const handleClickupValidate = React.useCallback(async () => {
    if (!job || !clickupToken.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await clickupWorkspaces(job.id, clickupToken.trim());
      setClickupTeams(resp.teams || []);
      const firstSpace = resp.teams?.[0]?.spaces?.[0];
      const firstList = firstSpace?.lists?.[0];
      setSelectedWorkspace(resp.teams?.[0]?.name || '');
      setSelectedClickupSpace(firstSpace?.id || '');
      setSelectedClickupList(firstList?.id || '');
      setAuthCompleted(true);
      setAuthError(null);
      message.success(t('auth.success', 'Connected'));
    } catch (err: any) {
      setAuthError(err?.message || t('auth.error', 'Connection failed. Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  }, [
    clickupToken,
    job,
    setAuthCompleted,
    setAuthError,
    setAuthLoading,
    setClickupTeams,
    setSelectedClickupList,
    setSelectedClickupSpace,
    setSelectedWorkspace,
    t,
  ]);

  const handleJiraValidate = React.useCallback(async () => {
    const email = jiraEmail.trim();
    const domain = normalizeDomain(jiraDomain);
    const token = jiraToken.trim();

    if (!job || !token || !email || !domain) return;
    if (!validateEmail(email)) {
      setAuthError(t('auth.jiraEmailInvalid', { defaultValue: 'Enter a valid email address.' }));
      return;
    }
    if (!isValidDomain(domain)) {
      setAuthError(
        t('auth.jiraDomainInvalid', {
          defaultValue:
            'Enter a valid domain, for example yourcompany.atlassian.net (without https://).',
        })
      );
      return;
    }

    if (domain !== jiraDomain) setJiraDomain(domain);

    setAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await jiraValidate(job.id, {
        token,
        email,
        domain,
      });
      setJiraProjects(resp.projects || []);
      setSelectedJiraProject(resp.projects?.[0]?.key || '');
      setAuthCompleted(true);
      setAuthError(null);
      message.success(t('auth.success', 'Connected'));
    } catch (err: any) {
      setAuthError((err?.response?.data as any)?.message || err?.message || t('auth.error', 'Connection failed. Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  }, [
    jiraDomain,
    jiraEmail,
    jiraToken,
    job,
    setAuthCompleted,
    setAuthError,
    setAuthLoading,
    setJiraDomain,
    setJiraProjects,
    setSelectedJiraProject,
    t,
  ]);

  return {
    handleAsanaAuth,
    handleMondayValidate,
    handleTrelloValidate,
    handleClickupValidate,
    handleJiraValidate,
  };
};

