import React from 'react';
import {
  Modal,
  Button,
  Typography,
  Upload,
  Card,
  Steps,
  Collapse,
  AutoComplete,
  Select,
  Input,
  Tooltip,
  message,
  theme,
  Space,
  Switch,
} from 'antd';
import {
  InfoCircleOutlined,
  RightOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ApartmentOutlined,
  TableOutlined,
  TeamOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import Papa from 'papaparse';
import { useTranslation } from 'react-i18next';
import {
  clickupWorkspaces,
  createImportJob,
  getImportJob,
  commitImportJob,
  ingestImportJob,
  trelloValidate,
  jiraValidate,
  mondayValidate,
  updateImportTarget,
  startAsanaAuth,
  saveImportFields,
  autoImportFields,
  autoImportHierarchy,
  updateImportSource,
} from '@/api/imports';
import type { ImportJob } from '@/api/imports';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectStatus } from '@/types/project/projectStatus.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

interface ImportSourceModalProps {
  open: boolean;
  onClose: () => void;
  source: {
    key: string;
    label: string;
    icon: React.ReactNode;
  } | null;
}

export const ImportSourceModal: React.FC<ImportSourceModalProps> = ({ open, onClose, source }) => {
  // Prevent ReferenceError by checking for source before any usage
  if (!source) return null;

  const { t } = useTranslation('settings/import-export');
  const { token: themeToken } = theme.useToken();

  // --- Dynamic import flow state ---
  // List of direct integration apps (use 4-step flow)
  const directIntegrationApps = [
    'asana',
    'monday',
    'clickup',
    'trello',
    'jira',
    'jira-software',
    'jira-business',
  ];
  const authGateApps = [
    'asana',
    'monday',
    'clickup',
    'trello',
    'jira',
    'jira-software',
    'jira-business',
  ];
  const lowerKey = source.key.toLowerCase();
  const isJira =
    lowerKey === 'jira' || lowerKey === 'jira-software' || lowerKey === 'jira-business';
  const integrationType = directIntegrationApps.includes(lowerKey) ? 'direct' : 'csv';
  const authNeeded = authGateApps.includes(lowerKey);
  const providerForApi = isJira
    ? 'jira'
    : directIntegrationApps.includes(lowerKey)
      ? lowerKey
      : 'csv';

  const [job, setJob] = React.useState<ImportJob | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [asanaWorkspaces, setAsanaWorkspaces] = React.useState<Array<{ id: string; name: string }>>(
    []
  );
  const [asanaProjects, setAsanaProjects] = React.useState<
    Array<{ id: string; name: string; workspaceId?: string }>
  >([]);
  const [mondayBoards, setMondayBoards] = React.useState<Array<{ id: string; name: string }>>([]);
  const [trelloBoards, setTrelloBoards] = React.useState<Array<{ id: string; name: string }>>([]);
  const [trelloKey, setTrelloKey] = React.useState('');
  const [trelloToken, setTrelloToken] = React.useState('');
  const [selectedTrelloBoard, setSelectedTrelloBoard] = React.useState('');
  const [clickupTeams, setClickupTeams] = React.useState<
    Array<{
      id: string;
      name: string;
      spaces: Array<{ id: string; name: string; lists: Array<{ id: string; name: string }> }>;
    }>
  >([]);
  const [clickupToken, setClickupToken] = React.useState('');
  const [authCompleted, setAuthCompleted] = React.useState(!authNeeded);
  const [mondayToken, setMondayToken] = React.useState('');
  const [selectedWorkspace, setSelectedWorkspace] = React.useState('');
  const [selectedProject, setSelectedProject] = React.useState('');
  const [selectedBoard, setSelectedBoard] = React.useState('');
  const [selectedClickupSpace, setSelectedClickupSpace] = React.useState('');
  const [selectedClickupList, setSelectedClickupList] = React.useState('');

  // JIRA-specific state
  const [jiraToken, setJiraToken] = React.useState('');
  const [jiraEmail, setJiraEmail] = React.useState('');
  const [jiraDomain, setJiraDomain] = React.useState('');
  const [jiraProjects, setJiraProjects] = React.useState<Array<{ key: string; name: string }>>([]);
  const [selectedJiraProject, setSelectedJiraProject] = React.useState('');

  React.useEffect(() => {
    setStep(0);
    setReviewSubScreen('main');
    setAuthCompleted(!authNeeded);
    setMondayToken('');
    setSelectedWorkspace('');
    setSelectedProject('');
    setSelectedBoard('');
    setSelectedTrelloBoard('');
    setSelectedClickupSpace('');
    setSelectedClickupList('');
    setAsanaProjects([]);
    setAsanaWorkspaces([]);
    setMondayBoards([]);
    setTrelloBoards([]);
    setClickupTeams([]);
    setClickupToken('');
    setTrelloKey('');
    setTrelloToken('');
    setAuthError(null);
    setShowCompletion(false);
    setCsvText('');
    setCsvRows([]);
    setSpaceName(source.label ? `${source.label} import` : '');
    setSpaceType('software');
    setSpaceTemplate('scrum');
    setIsImporting(false);
    setFieldMappingRows([]);
    setHierarchyRows([]);

    let cancelled = false;
    const initJob = async () => {
      try {
        const created = await createImportJob({
          provider: providerForApi,
          flowType: integrationType as 'direct' | 'csv',
        });
        if (!cancelled) setJob(created);
      } catch (err) {
        if (!cancelled) setJob(null);
      }
    };
    initJob();

    return () => {
      cancelled = true;
    };
  }, [source, authNeeded]);

  // Steps for each flow
  const steps =
    integrationType === 'direct'
      ? ['Select list', 'Create space', 'Review Details & Import']
      : ['Upload CSV', 'Set up space', 'Map fields', 'Map values', 'Move users', 'Review details'];

  const [step, setStep] = React.useState(0);
  const totalSteps = steps.length;
  const [showCompletion, setShowCompletion] = React.useState(false);
  // Review Details sub-screens
  const [reviewSubScreen, setReviewSubScreen] = React.useState<
    'main' | 'hierarchy' | 'fieldMapping'
  >('main');
  // Toggles for review details
  const [importMembers, setImportMembers] = React.useState(true);
  const [importAttachments, setImportAttachments] = React.useState(true);

  const [fieldMappingRows, setFieldMappingRows] = React.useState<
    Array<{ source_field: string; target_field: string; required?: boolean; include?: boolean }>
  >([]);
  const [hierarchyRows, setHierarchyRows] = React.useState<
    Array<{ source_level: string; target_level: string; position?: number }>
  >([]);
  const [csvSettingsOpen, setCsvSettingsOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [encoding, setEncoding] = React.useState('UTF-8');

  // State for CSV columns and mapping
  const [csvColumns, setCsvColumns] = React.useState<string[]>([]);
  const [csvText, setCsvText] = React.useState<string>('');
  const [csvRows, setCsvRows] = React.useState<Record<string, any>[]>([]);
  const [fieldMappings, setFieldMappings] = React.useState<Record<string, string>>({});
  const [includeInImport, setIncludeInImport] = React.useState<Record<string, boolean>>({});
  // Delimiter for CSV parsing
  const [delimiter, setDelimiter] = React.useState<string>('');

  // Search/filter for mapping step
  const [searchValue, setSearchValue] = React.useState<string>('');
  const [filter, setFilter] = React.useState<string>('all');

  // Work type mapping step
  const [workTypeMapping, setWorkTypeMapping] = React.useState<Record<string, string>>({});

  // Move users step state
  const [addUsers, setAddUsers] = React.useState<boolean>(true);
  const [userEmails, setUserEmails] = React.useState<Record<string, string>>({});

  // Importing state
  const [isImporting, setIsImporting] = React.useState<boolean>(false);
  const [autoMappingRunning, setAutoMappingRunning] = React.useState(false);
  const [spaceName, setSpaceName] = React.useState<string>('');
  const [spaceType, setSpaceType] = React.useState<string>('software');
  const [spaceTemplate, setSpaceTemplate] = React.useState<string>('scrum');
  const [defaultProjectStatusId, setDefaultProjectStatusId] = React.useState<string | null>(null);
  const [worklenzStatuses, setWorklenzStatuses] = React.useState<IProjectStatus[]>([]);
  const worklenzFieldOptions = React.useMemo(
    () => [
      { value: 'key', label: 'Key' },
      { value: 'description', label: 'Description' },
      { value: 'progress', label: 'Progress' },
      { value: 'status', label: 'Status' },
      { value: 'assignees', label: 'Assignees' },
      { value: 'labels', label: 'Labels' },
      { value: 'phase', label: 'Phase' },
      { value: 'priority', label: 'Priority' },
      { value: 'timeTracking', label: 'Time Tracking' },
      { value: 'estimation', label: 'Estimation' },
      { value: 'startDate', label: 'Start Date' },
      { value: 'dueDate', label: 'Due Date' },
      { value: 'dueTime', label: 'Due Time' },
      { value: 'completedDate', label: 'Completed Date' },
      { value: 'createdDate', label: 'Created Date' },
      { value: 'lastUpdated', label: 'Last Updated' },
      { value: 'reporter', label: 'Reporter' },
    ],
    []
  );

  const defaultWorkTypes = React.useMemo(
    () => [
      {
        id: 'todo',
        name: t('importStep.statusTodo', 'To Do'),
        color_code: '#fbbf24',
        sort_order: 0,
      },
      {
        id: 'doing',
        name: t('importStep.statusDoing', 'Doing'),
        color_code: '#3b82f6',
        sort_order: 1,
      },
      {
        id: 'done',
        name: t('importStep.statusDone', 'Done'),
        color_code: '#22c55e',
        sort_order: 2,
      },
    ],
    [t]
  );

  const statusColumnKey = React.useMemo(
    () => Object.entries(fieldMappings).find(([, target]) => target === 'status')?.[0],
    [fieldMappings]
  );

  const statusValues = React.useMemo(() => {
    if (!statusColumnKey) return [] as string[];
    const values = new Set<string>();
    csvRows.forEach(row => {
      const raw = row?.[statusColumnKey];
      if (typeof raw === 'string' && raw.trim()) values.add(raw.trim());
    });
    return Array.from(values);
  }, [csvRows, statusColumnKey]);

  const workTypeOptions = React.useMemo(() => {
    const sourceStatuses = worklenzStatuses.length ? worklenzStatuses : defaultWorkTypes;
    return sourceStatuses.map(status => ({
      key: status.id || status.name || 'status',
      label: status.name || t('importStep.statusFallback', 'Status'),
      icon: (
        <span
          style={{
            width: 10,
            height: 10,
            display: 'inline-block',
            borderRadius: '50%',
            background: status.color_code || '#64748b',
          }}
        />
      ),
      level: typeof status.sort_order === 'number' ? status.sort_order : 0,
    }));
  }, [defaultWorkTypes, t, worklenzStatuses]);

  const mappedFieldCount = React.useMemo(
    () => fieldMappingRows.filter(row => row.include !== false).length,
    [fieldMappingRows]
  );

  const modalDims = React.useMemo(() => {
    if (integrationType === 'csv') {
      const isReviewStep = step === 5; // step index 5 = "Review details" in CSV flow
      return {
        width: 1180,
        height: isReviewStep ? 900 : 820,
        stepperMaxWidth: 1120,
      };
    }

    return { width: 900, height: 753, stepperMaxWidth: 820 };
  }, [integrationType, step]);
  const hierarchyCount = React.useMemo(() => hierarchyRows.length, [hierarchyRows]);
  const hierarchyDisplayRows = React.useMemo(
    () => [...hierarchyRows].sort((a, b) => (a.position || 0) - (b.position || 0)),
    [hierarchyRows]
  );

  const autoMappedRef = React.useRef(false);

  const runAutoMapping = React.useCallback(
    async (suppressToast?: boolean) => {
      if (!job?.id) return;
      try {
        setAutoMappingRunning(true);
        const fieldsResp = await autoImportFields(job.id);
        if (Array.isArray(fieldsResp)) setFieldMappingRows(fieldsResp as any);
        const hierarchyResp = await autoImportHierarchy(job.id);
        if (Array.isArray(hierarchyResp)) setHierarchyRows(hierarchyResp as any);
        autoMappedRef.current = true;
        if (!suppressToast)
          message.success(t('importStep.autoMapped', 'Fields and hierarchy auto-mapped'));
      } catch (err) {
        if (!suppressToast)
          message.error(t('importStep.autoMapError', 'Auto-mapping failed. Please try again.'));
      } finally {
        setAutoMappingRunning(false);
      }
    },
    [job?.id, t]
  );

  React.useEffect(() => {
    let cancelled = false;
    const fetchStatuses = async () => {
      try {
        const resp = await projectsApiService.getProjectStatuses();
        if (cancelled) return;
        const statuses = resp?.body || [];
        if (statuses.length) {
          setWorklenzStatuses(statuses);
          const defaultStatus = statuses.find(status => status.is_default) || statuses[0];
          if (defaultStatus?.id) {
            setDefaultProjectStatusId(id => id || defaultStatus.id || null);
          }
          return;
        }
      } catch (error) {
        // ignore and fall back
      }

      if (!cancelled) {
        setWorklenzStatuses(defaultWorkTypes);
        const fallbackDefault = defaultWorkTypes[0]?.id;
        if (fallbackDefault) setDefaultProjectStatusId(id => id || fallbackDefault);
      }
    };

    fetchStatuses();

    return () => {
      cancelled = true;
    };
  }, [defaultWorkTypes]);

  React.useEffect(() => {
    autoMappedRef.current = false;
  }, [
    lowerKey,
    selectedTrelloBoard,
    selectedProject,
    selectedBoard,
    selectedJiraProject,
    selectedClickupList,
  ]);

  React.useEffect(() => {
    if (integrationType !== 'direct') return;
    if (step !== 2) return;
    if (autoMappingRunning) return;
    if (autoMappedRef.current) return;
    if (!job?.id) return;

    const trelloReady = lowerKey !== 'trello' || (authCompleted && !!selectedTrelloBoard);
    if (!trelloReady) return;

    void runAutoMapping(true);
  }, [
    integrationType,
    step,
    autoMappingRunning,
    job?.id,
    lowerKey,
    authCompleted,
    selectedTrelloBoard,
    runAutoMapping,
  ]);

  const navigationDisabled = authNeeded && !authCompleted;

  const ensureImportJob = React.useCallback(async () => {
    if (job) return job;
    const created = await createImportJob({
      provider: providerForApi,
      flowType: integrationType as 'direct' | 'csv',
    });
    setJob(created);
    return created;
  }, [integrationType, job, providerForApi]);

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
  }, [defaultProjectStatusId, defaultWorkTypes, t, worklenzStatuses]);

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

  const handleBack = () => setStep(s => Math.max(0, s - 1));
  const handleNext = () => setStep(s => Math.min(totalSteps - 1, s + 1));
  const handleModalClose = () => {
    setStep(0);
    onClose();
  };
  const handleFinish = async () => {
    if (integrationType === 'direct') {
      if (!spaceName.trim()) {
        message.error(t('importStep.spaceNameRequired', 'Please enter a space name.'));
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
          const statusId = await ensureDefaultProjectStatusId();
          const projectPayload: IProjectViewModel = {
            name: spaceName.trim(),
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
          };

          const projectResp = await projectsApiService.createProject(projectPayload);
          const projectId = projectResp?.body?.id;
          if (!projectResp?.done || !projectId) {
            throw new Error(
              projectResp?.message || t('importStep.projectCreateError', 'Failed to create project')
            );
          }

          await updateImportTarget(job.id, {
            targetProjectId: projectId,
            targetSpaceType: spaceType,
            targetTemplate: spaceTemplate,
          });

          const projectName = asanaProjects.find(p => p.id === selectedProject)?.name;
          await persistAsanaSelection(selectedProject, selectedWorkspace, projectName);

          if (!fieldMappingRows.length || !hierarchyRows.length) {
            await runAutoMapping(true);
          }

          if (fieldMappingRows.length) {
            await saveImportFields(job.id, fieldMappingRows as any);
          }

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

          setShowCompletion(false);
          message.success(
            t('importStep.importStarted', 'Import started. We will notify once ready.')
          );
          onClose();
        } catch (err: any) {
          message.error(
            err?.message || t('importStep.importError', 'Import failed. Please try again.')
          );
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
          const statusId = await ensureDefaultProjectStatusId();
          const projectPayload: IProjectViewModel = {
            name: spaceName.trim(),
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
          };

          const projectResp = await projectsApiService.createProject(projectPayload);
          const projectId = projectResp?.body?.id;
          if (!projectResp?.done || !projectId) {
            throw new Error(
              projectResp?.message || t('importStep.projectCreateError', 'Failed to create project')
            );
          }

          await updateImportTarget(job.id, {
            targetProjectId: projectId,
            targetSpaceType: spaceType,
            targetTemplate: spaceTemplate,
          });

          const projectName = jiraProjects.find(p => p.key === selectedJiraProject)?.name;
          await updateImportSource(job.id, {
            projectKey: selectedJiraProject,
            projectId: selectedJiraProject,
            projectName,
          });

          if (!fieldMappingRows.length || !hierarchyRows.length) {
            await runAutoMapping(true);
          }

          if (fieldMappingRows.length) {
            await saveImportFields(job.id, fieldMappingRows as any);
          }

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

          setShowCompletion(false);
          message.success(
            t('importStep.importStarted', 'Import started. We will notify once ready.')
          );
          onClose();
        } catch (err: any) {
          message.error(
            err?.message || t('importStep.importError', 'Import failed. Please try again.')
          );
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
          const statusId = await ensureDefaultProjectStatusId();
          const projectPayload: IProjectViewModel = {
            name: spaceName.trim(),
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
          };

          const projectResp = await projectsApiService.createProject(projectPayload);
          const projectId = projectResp?.body?.id;
          if (!projectResp?.done || !projectId) {
            throw new Error(
              projectResp?.message || t('importStep.projectCreateError', 'Failed to create project')
            );
          }

          await updateImportTarget(job.id, {
            targetProjectId: projectId,
            targetSpaceType: spaceType,
            targetTemplate: spaceTemplate,
          });

          const boardName = trelloBoards.find(b => b.id === selectedTrelloBoard)?.name || null;
          await updateImportSource(job.id, {
            boardId: selectedTrelloBoard,
            boardName,
          });

          if (!fieldMappingRows.length || !hierarchyRows.length) {
            await runAutoMapping(true);
          }

          if (fieldMappingRows.length) {
            await saveImportFields(job.id, fieldMappingRows as any);
          }

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

          setShowCompletion(false);
          message.success(
            t('importStep.importStarted', 'Import started. We will notify once ready.')
          );
          onClose();
        } catch (err: any) {
          message.error(
            err?.message || t('importStep.importError', 'Import failed. Please try again.')
          );
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
      message.error(t('importStep.spaceNameRequired', 'Please enter a space name.'));
      return;
    }

    setIsImporting(true);
    try {
      const activeJob = await ensureImportJob();
      const statusId = await ensureDefaultProjectStatusId();

      const projectPayload: IProjectViewModel = {
        name: spaceName.trim(),
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
      };

      const projectResp = await projectsApiService.createProject(projectPayload);
      const projectId = projectResp?.body?.id;
      if (!projectResp?.done || !projectId) {
        throw new Error(
          projectResp?.message || t('importStep.projectCreateError', 'Failed to create project')
        );
      }

      await updateImportTarget(activeJob.id, {
        targetProjectId: projectId,
        targetSpaceType: spaceType,
        targetTemplate: spaceTemplate,
      });

      await ingestImportJob(activeJob.id, {
        csvText,
        sourceReference: { provider: lowerKey },
      });

      const mappedFields = csvColumns
        .filter(col => includeInImport[col] !== false && fieldMappings[col])
        .map(col => ({
          source_field: col,
          target_field: fieldMappings[col],
          include: includeInImport[col] !== false,
        }));

      if (mappedFields.length) {
        await saveImportFields(activeJob.id, mappedFields);
      }

      const commitProgress = await commitImportJob(activeJob.id);
      if (commitProgress?.job) setJob(commitProgress.job as ImportJob);

      setShowCompletion(false);
      message.success(t('importStep.importStarted', 'Import started. We will notify once ready.'));
      onClose();
    } catch (err: any) {
      message.error(
        err?.message || t('importStep.importError', 'Import failed. Please try again.')
      );
    } finally {
      setIsImporting(false);
    }
  };
  const handleStartNewImport = () => {
    setShowCompletion(false);
    handleModalClose();
  };

  const handleAsanaAuth = async () => {
    if (!job) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { authUrl } = await startAsanaAuth(job.id);
      // open the Asana auth page in a new tab to avoid navigating away from the app
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
        } catch (err) {
          // swallow and continue polling
        }
      }, 2000);
    } catch (err: any) {
      setAuthError(err?.message || t('auth.error', 'Connection failed. Please try again.'));
      setAuthLoading(false);
    }
  };

  const handleMondayValidate = async () => {
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
  };

  const handleTrelloValidate = async () => {
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
        } catch (err) {
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
  };

  const handleClickupValidate = async () => {
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
  };

  const handleJiraValidate = async () => {
    if (!job || !jiraToken.trim() || !jiraEmail.trim() || !jiraDomain.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const resp = await jiraValidate(job.id, {
        token: jiraToken.trim(),
        email: jiraEmail.trim(),
        domain: jiraDomain.trim(),
      });
      setJiraProjects(resp.projects || []);
      setSelectedJiraProject(resp.projects?.[0]?.key || '');
      setAuthCompleted(true);
      setAuthError(null);
      message.success(t('auth.success', 'Connected'));
    } catch (err: any) {
      setAuthError(err?.message || t('auth.error', 'Connection failed. Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  };

  // Example content for each step
  function renderStepContent() {
    const directContainerStyle = {
      width: '100%',
      maxWidth: 820,
      margin: '0 auto',
      background: '#2684FF08',
      borderRadius: 12,
      padding: 32,
    };

    if (integrationType === 'direct') {
      // 3-step direct integration flow
      if (step === 0) {
        // Step 1: Select project/list/board
        const workspaceOptions =
          lowerKey === 'asana'
            ? asanaWorkspaces.map(ws => ({ value: ws.id, label: ws.name }))
            : lowerKey === 'clickup'
              ? clickupTeams.flatMap(team =>
                  team.spaces.map(space => ({
                    value: space.id,
                    label: `${team.name} â€¢ ${space.name}`,
                  }))
                )
              : isJira
                ? jiraProjects.map(p => ({ value: p.key, label: p.name }))
                : [];
        const projectOptions =
          lowerKey === 'asana'
            ? asanaProjects
                .filter(p => !selectedWorkspace || p.workspaceId === selectedWorkspace)
                .map(p => ({ value: p.id, label: p.name }))
            : isJira
              ? jiraProjects.map(p => ({ value: p.key, label: p.name }))
              : [];
        const boardOptions =
          lowerKey === 'monday'
            ? mondayBoards.map(b => ({ value: b.id, label: b.name }))
            : lowerKey === 'trello'
              ? trelloBoards.map(b => ({ value: b.id, label: b.name }))
              : [];

        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={directContainerStyle}>
              <Typography.Title level={3} style={{ marginBottom: 8 }}>
                {t('importStep.selectList', 'Select a source')}
              </Typography.Title>
              <Typography.Paragraph style={{ color: themeToken.colorTextSecondary }}>
                {t(
                  'importStep.selectListHelp',
                  'Select the workspace and list/board youâ€™d like to import data from. Required fields are marked with an asterisk.'
                )}
              </Typography.Paragraph>
              <div style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
                {lowerKey !== 'monday' && lowerKey !== 'jira' && lowerKey !== 'trello' && (
                  <>
                    <label>{t('importStep.workspaceLabel', 'Workspace *')}</label>
                    <Select
                      style={{ width: '100%', marginBottom: 24 }}
                      placeholder={t('auth.clickupSelect', 'Select workspace')}
                      value={selectedWorkspace || undefined}
                      onChange={value => {
                        setSelectedWorkspace(value);
                        setSelectedProject('');
                      }}
                      options={workspaceOptions}
                      disabled={!authCompleted}
                    />
                  </>
                )}

                {isJira && (
                  <>
                    <label style={{ display: 'block', marginBottom: 4 }}>
                      {t('importStep.jiraDomain', 'Domain')}
                    </label>
                    <Typography.Text
                      style={{
                        display: 'block',
                        marginBottom: 24,
                        color: themeToken.colorTextSecondary,
                      }}
                    >
                      {jiraDomain}
                    </Typography.Text>
                  </>
                )}

                <label>
                  {lowerKey === 'monday' || lowerKey === 'trello'
                    ? t('importStep.boardLabel', 'Board *')
                    : isJira
                      ? t('importStep.jiraProjectLabel', 'Project *')
                      : t('importStep.projectLabel', 'List/Project *')}
                </label>
                {lowerKey === 'monday' ? (
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('importStep.boardPlaceholder', 'Select a board')}
                    value={selectedBoard || undefined}
                    onChange={v => setSelectedBoard(v)}
                    options={boardOptions}
                    disabled={!authCompleted}
                  />
                ) : lowerKey === 'trello' ? (
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('importStep.boardPlaceholder', 'Select a board')}
                    value={selectedTrelloBoard || undefined}
                    onChange={async v => {
                      setSelectedTrelloBoard(v);
                      const boardName = trelloBoards.find(b => b.id === v)?.name;
                      try {
                        if (job?.id) {
                          await updateImportSource(job.id, { boardId: v, boardName });
                          await runAutoMapping();
                        }
                      } catch (err: any) {
                        message.error(
                          err?.message || t('importStep.autoMapError', 'Auto-mapping failed')
                        );
                      }
                    }}
                    options={boardOptions}
                    disabled={!authCompleted}
                  />
                ) : lowerKey === 'clickup' ? (
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('importStep.listPlaceholder', 'Select a list')}
                    value={selectedClickupList || undefined}
                    onChange={v => setSelectedClickupList(v)}
                    options={clickupTeams
                      .flatMap(team => team.spaces)
                      .filter(space => !selectedClickupSpace || space.id === selectedClickupSpace)
                      .flatMap(space =>
                        space.lists.map(list => ({ value: list.id, label: list.name }))
                      )}
                    disabled={!authCompleted}
                  />
                ) : isJira ? (
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('importStep.jiraProjectPlaceholder', 'Select a project')}
                    value={selectedJiraProject || undefined}
                    onChange={async v => {
                      setSelectedJiraProject(v);
                      const projectName = jiraProjects.find(p => p.key === v)?.name;
                      try {
                        await updateImportSource(job!.id, {
                          projectKey: v,
                          projectId: v,
                          projectName: projectName,
                        });
                        await runAutoMapping();
                      } catch (err: any) {
                        message.error(
                          err?.message || t('importStep.autoMapError', 'Auto-mapping failed')
                        );
                      }
                    }}
                    options={projectOptions}
                    disabled={!authCompleted}
                  />
                ) : (
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('importStep.projectPlaceholder', 'Select a project')}
                    value={selectedProject || undefined}
                    onChange={async v => {
                      setSelectedProject(v);
                      const projectName = asanaProjects.find(p => p.id === v)?.name;
                      try {
                        await persistAsanaSelection(v, selectedWorkspace, projectName);
                        await runAutoMapping();
                      } catch (err: any) {
                        message.error(
                          err?.message || t('importStep.autoMapError', 'Auto-mapping failed')
                        );
                      }
                    }}
                    options={projectOptions}
                    disabled={!authCompleted}
                  />
                )}
              </div>
            </div>
          </div>
        );
      }
      if (step === 1) {
        // Step 2: Create space
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={directContainerStyle}>
              <Typography.Title level={3} style={{ marginBottom: 8 }}>
                {t('importStep.setupSpaceTitle', 'Set up a space in Worklenz')}
              </Typography.Title>
              <Typography.Paragraph style={{ color: themeToken.colorTextSecondary }}>
                {t('importStep.setupSpaceDesc', {
                  defaultValue:
                    "Your team's data from {{source}} will be imported into this space. Check if you're selecting the right Worklenz space, template, and space type as these options can't be modified later. All fields are required.",
                  source: source.label || 'your app',
                })}
              </Typography.Paragraph>
              <div style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
                <label>{t('importStep.worklenzSpace', 'Worklenz space')}</label>
                <Select
                  style={{ width: '100%', marginBottom: 16 }}
                  value={spaceType}
                  onChange={setSpaceType}
                  options={[
                    { value: 'business', label: t('importStep.businessSpace', 'Business space') },
                    { value: 'software', label: t('importStep.softwareSpace', 'Software space') },
                  ]}
                />
                <label>{t('importStep.spaceName', 'Space name')}</label>
                <Input
                  style={{ width: '100%', marginBottom: 8 }}
                  value={spaceName}
                  onChange={e => setSpaceName(e.target.value)}
                />
                <a href="#" style={{ color: '#4096ff', fontSize: 14 }}>
                  {t('importStep.showMore', 'Show more')}
                </a>
              </div>
            </div>
          </div>
        );
      }
      if (step === 2) {
        // Step 3: Review details & import
        if (reviewSubScreen === 'main') {
          /*
          const reviewCards = [
            {
              key: 'hierarchy',
              title: t('importStep.spaceHierarchy', 'Space hierarchy'),
              description:
                hierarchyCount > 0
                  ? t('importStep.hierarchyLevelsMapped', {
                      defaultValue: '{{count}} hierarchy levels mapped',
                      count: hierarchyCount,
                    })
                  : t('importStep.sectionsMapped', {
                      defaultValue: 'Sections from {{source}} are mapped to Status',
                      source: source.label || 'source',
                    }),
              iconBg: '#1f6feb',
              icon: '4e6',
              action: () => setReviewSubScreen('hierarchy'),
              control: <RightOutlined style={{ color: '#9ca3af', fontSize: 16 }} />,
            },
            {
              key: 'fieldMapping',
              title: t('importStep.fieldMapping', 'Field mapping'),
              description:
                fieldMappingRows.length > 0
                  ? t('importStep.fieldsMapped', {
                      defaultValue: '{{mapped}}/{{total}} fields mapped',
                      mapped: mappedFieldCount,
                      total: fieldMappingRows.length,
                    })
                  : t('importStep.fieldsAutoMap', {
                      defaultValue: 'Fields will auto-map from {{source}}',
                      source: source.label || 'source',
                    }),
              iconBg: '#6e56cf',
              icon: '4d1',
              action: () => setReviewSubScreen('fieldMapping'),
              control: <RightOutlined style={{ color: '#9ca3af', fontSize: 16 }} />,
            },
            {
              key: 'importMembers',
              title: t('importStep.importMembers', {
                defaultValue: 'Import all members from {{source}} project',
                source: source.label || 'source',
              }),
              description: t(
                'importStep.importMembersDesc',
                'Brings collaborators into the Worklenz space'
              ),
              iconBg: '#0f9d58',
              icon: '9d100d91d00d9d1',
              action: undefined,
              control: <Switch checked={importMembers} onChange={setImportMembers} />,
            },
            {
              key: 'importAttachments',
              title: t('importStep.importAttachments', 'Import all attachments'),
              description: t(
                'importStep.importAttachmentsDesc',
                'Pulls files and images from tasks'
              ),
              iconBg: '#f59e0b',
              icon: '4ce',
              action: undefined,
              control: <Switch checked={importAttachments} onChange={setImportAttachments} />,
            },
          ];
          */

          const reviewCards = [
            {
              key: 'hierarchy',
              title: t('importStep.spaceHierarchy', 'Space hierarchy'),
              description:
                hierarchyCount > 0
                  ? t('importStep.hierarchyLevelsMapped', {
                      defaultValue: '{{count}} hierarchy levels mapped',
                      count: hierarchyCount,
                    })
                  : t('importStep.sectionsMapped', {
                      defaultValue: 'Sections from {{source}} are mapped to Status',
                      source: source.label || 'source',
                    }),
              iconBg: '#1f6feb',
              icon: <ApartmentOutlined style={{ color: '#fff' }} />,
              action: () => setReviewSubScreen('hierarchy'),
              control: <RightOutlined style={{ color: '#9ca3af', fontSize: 16 }} />,
            },
            {
              key: 'fieldMapping',
              title: t('importStep.fieldMapping', 'Field mapping'),
              description:
                fieldMappingRows.length > 0
                  ? t('importStep.fieldsMapped', {
                      defaultValue: '{{mapped}}/{{total}} fields mapped',
                      mapped: mappedFieldCount,
                      total: fieldMappingRows.length,
                    })
                  : t('importStep.fieldsAutoMap', {
                      defaultValue: 'Fields will auto-map from {{source}}',
                      source: source.label || 'source',
                    }),
              iconBg: '#6e56cf',
              icon: <TableOutlined style={{ color: '#fff' }} />,
              action: () => setReviewSubScreen('fieldMapping'),
              control: <RightOutlined style={{ color: '#9ca3af', fontSize: 16 }} />,
            },
            {
              key: 'importMembers',
              title: t('importStep.importMembers', {
                defaultValue: 'Import all members from {{source}} project',
                source: source.label || 'source',
              }),
              description: t(
                'importStep.importMembersDesc',
                'Brings collaborators into the Worklenz space'
              ),
              iconBg: '#0f9d58',
              icon: <TeamOutlined style={{ color: '#fff' }} />,
              action: undefined,
              control: <Switch checked={importMembers} onChange={setImportMembers} />,
            },
            {
              key: 'importAttachments',
              title: t('importStep.importAttachments', 'Import all attachments'),
              description: t(
                'importStep.importAttachmentsDesc',
                'Pulls files and images from tasks'
              ),
              iconBg: '#f59e0b',
              icon: <PaperClipOutlined style={{ color: '#fff' }} />,
              action: undefined,
              control: <Switch checked={importAttachments} onChange={setImportAttachments} />,
            },
          ];

          return (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={directContainerStyle}>
                <Typography.Title level={3} style={{ marginBottom: 4 }}>
                  {t('importStep.reviewDetails', 'Review Details & Import')}
                </Typography.Title>
                <Typography.Paragraph
                  style={{ marginBottom: 24, color: themeToken.colorTextSecondary }}
                >
                  {t('importStep.reviewIntro', {
                    defaultValue:
                      "We've mapped your project and you're ready to import. Here's how the {{source}} data will be imported into the {{target}} project. Learn more about the project setup",
                    source: source.label || 'source',
                    target: 'Worklenz',
                  })}
                </Typography.Paragraph>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reviewCards.map(card => (
                    <Card
                      key={card.key}
                      hoverable
                      onClick={card.action}
                      bordered={false}
                      style={{
                        borderRadius: 10,
                        background: '#fff',
                        boxShadow: '0 12px 34px rgba(38,132,255,0.12)',
                        border: '1px solid #e8eef9',
                        cursor: card.action ? 'pointer' : 'default',
                      }}
                      bodyStyle={{ padding: 14 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 10,
                            background: card.iconBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 22,
                          }}
                        >
                          {card.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              color: themeToken.colorTextHeading,
                              fontWeight: 600,
                              fontSize: 16,
                            }}
                          >
                            {card.title}
                          </div>
                          <div style={{ color: themeToken.colorTextSecondary, fontSize: 13 }}>
                            {card.description}
                          </div>
                        </div>
                        <div>{card.control}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        if (reviewSubScreen === 'hierarchy') {
          // Space hierarchy sub-screen
          return (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: 820,
                  minHeight: 469,
                  background: '#2684FF08',
                  borderRadius: 10,
                  padding: '40px 40px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <a
                    href="#"
                    style={{ color: '#2684FF', display: 'inline-flex', alignItems: 'center' }}
                    onClick={e => {
                      e.preventDefault();
                      setReviewSubScreen('main');
                    }}
                  >
                    <RightOutlined
                      style={{ fontSize: 12, marginRight: 6, transform: 'rotate(180deg)' }}
                    />
                    {t('importStep.backToReview', 'Back to review details')}
                  </a>
                  <div style={{ flex: 1 }} />
                  <Button type="primary">{t('common.save', 'Save')}</Button>
                </div>

                <Typography.Title level={3} style={{ margin: '0 0 4px' }}>
                  {t('importStep.spaceHierarchy', 'Space hierarchy')}
                </Typography.Title>
                <Typography.Paragraph
                  style={{ marginBottom: 16, color: themeToken.colorTextSecondary }}
                >
                  {t(
                    'importStep.hierarchyIntro',
                    "How we've mapped your Asana data to Worklenz. More about project hierarchy in Worklenz."
                  )}
                </Typography.Paragraph>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: '#F8C7C7',
                      color: '#b11e1e',
                      fontWeight: 600,
                    }}
                  >
                    {source.label}
                  </span>
                  <span style={{ fontSize: 16, color: '#111' }}>?</span>
                  <span
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: '#C8D9F4',
                      color: '#0b3c91',
                      fontWeight: 700,
                    }}
                  >
                    Worklenz
                  </span>
                </div>

                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e8eef9',
                    boxShadow: '0 8px 26px rgba(38,132,255,0.12)',
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {hierarchyDisplayRows.map((row, idx) => (
                    <div
                      key={`${row.source_level}-${idx}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 40px 1.4fr',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        background: '#fff',
                        borderRadius: 10,
                        border: '1px solid #eef3fb',
                      }}
                    >
                      <div style={{ color: '#1f2a44', fontWeight: 600, fontSize: 15 }}>
                        {row.source_level}
                      </div>
                      <RightOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
                      <Select
                        value={row.target_level}
                        style={{ width: '100%' }}
                        options={(
                          [
                            { value: row.target_level, label: row.target_level },
                            { value: 'Status', label: 'Status' },
                          ] as Array<{ value: string; label: string }>
                        ).reduce((acc: Array<{ value: string; label: string }>, cur) => {
                          if (!acc.find(a => a.value === cur.value)) acc.push(cur);
                          return acc;
                        }, [])}
                        onChange={value =>
                          setHierarchyRows(rows =>
                            rows.map((current, currentIdx) =>
                              currentIdx === idx
                                ? { ...current, target_level: value as string }
                                : current
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        if (reviewSubScreen === 'fieldMapping') {
          // Field mapping sub-screen
          const fieldMappingTitle = t('importStep.fieldMappingTitle', 'Field mapping');
          const fieldMappingDescription = t(
            'importStep.fieldMappingDescription',
            "We've automatically mapped your {{source}} data into system and custom fields in Worklenz. You can customize some fields that have other compatible field types. More about field mapping.",
            { source: source.label || 'source' }
          );

          return (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: 820,
                  maxWidth: 820,
                  minWidth: 820,
                  height: 657.26,
                  minHeight: 657.26,
                  background: '#f5f8ff',
                  borderRadius: 10,
                  border: '1px solid #e4ecfb',
                  padding: '14px 32px 40px',
                  boxShadow: '0 10px 40px rgba(38,132,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  margin: '0 auto 24px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <a
                    href="#"
                    style={{
                      color: '#2684ff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 600,
                    }}
                    onClick={e => {
                      e.preventDefault();
                      setReviewSubScreen('main');
                    }}
                  >
                    <ArrowLeftOutlined style={{ fontSize: 14 }} />
                    {t('importStep.backToReview', 'Back to review details')}
                  </a>
                  <Button type="primary">{t('common.save', 'Save')}</Button>
                </div>

                <div>
                  <Typography.Title
                    level={3}
                    style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {fieldMappingTitle}
                  </Typography.Title>
                  <Typography.Paragraph style={{ margin: 0, color: themeToken.colorTextSecondary }}>
                    {fieldMappingDescription}
                  </Typography.Paragraph>
                </div>

                <div style={{ marginTop: 20, marginBottom: 16 }}>
                  <Input
                    placeholder={t('importStep.searchFields', 'Search fields')}
                    prefix={<SearchOutlined />}
                    style={{
                      width: '100%',
                      maxWidth: 560,
                      background: '#fff',
                      borderColor: '#e1e7f5',
                    }}
                  />
                </div>

                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e5ecf8',
                    boxShadow: '0 6px 22px rgba(38,132,255,0.06)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: 500,
                    marginBottom: -10,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1.5fr 150px',
                      alignItems: 'center',
                      padding: '12px 14px',
                      background: '#f7f9fc',
                      color: '#5a6475',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ paddingLeft: 2 }}>
                      {t('importStep.sourceField', {
                        defaultValue: '{{source}} field',
                        source: source.label || 'Source',
                      })}
                    </span>
                    <span>{t('importStep.worklenzField', 'Worklenz field')}</span>
                    <span style={{ textAlign: 'center' }}>
                      {t('importStep.includeInImport', 'Include in import')}
                    </span>
                  </div>

                  {fieldMappingRows.length === 0 ? (
                    <div
                      style={{
                        padding: '14px 16px',
                        color: themeToken.colorTextSecondary,
                        fontWeight: 500,
                      }}
                    >
                      {t(
                        'importStep.autoMapPlaceholder',
                        'Auto-mapping will populate fields here.'
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        overflowX: 'auto',
                        maxHeight: 340,
                        paddingRight: 6,
                        paddingBottom: 12,
                        WebkitOverflowScrolling: 'touch',
                      }}
                    >
                      {fieldMappingRows.map((row, idx) => {
                        const options = [
                          { value: row.target_field, label: row.target_field },
                          ...worklenzFieldOptions,
                        ].filter(
                          (option, optionIdx, arr) =>
                            arr.findIndex(a => a.value === option.value) === optionIdx
                        );

                        return (
                          <div
                            key={`${row.source_field}-${idx}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1.2fr 1.5fr 150px',
                              alignItems: 'center',
                              gap: 12,
                              padding: '12px 14px',
                              background: idx % 2 === 0 ? '#fff' : '#f9fbff',
                              borderTop: idx === 0 ? '1px solid #eef3fb' : '1px solid #eef3fb',
                            }}
                          >
                            <span style={{ color: '#1f2a44', paddingLeft: 2, fontWeight: 600 }}>
                              {row.source_field}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Select
                                value={row.target_field}
                                style={{ width: '100%' }}
                                options={options}
                                onChange={value =>
                                  setFieldMappingRows(rows =>
                                    rows.map((current, currentIdx) =>
                                      currentIdx === idx
                                        ? { ...current, target_field: value as string }
                                        : current
                                    )
                                  )
                                }
                              />
                              {row.required && (
                                <span
                                  style={{
                                    background: '#f0f4ff',
                                    color: '#2c3c67',
                                    fontSize: 10,
                                    borderRadius: 6,
                                    padding: '2px 6px',
                                    letterSpacing: 0.4,
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                  }}
                                >
                                  {t('importStep.required', 'Required')}
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <Switch
                                checked={row.include !== false}
                                onChange={checked =>
                                  setFieldMappingRows(rows =>
                                    rows.map((current, currentIdx) =>
                                      currentIdx === idx
                                        ? { ...current, include: checked }
                                        : current
                                    )
                                  )
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }
      }
      return null;
    }
    // ...existing code for CSV import steps...
    switch (step) {
      case 0:
        return (
          <>
            <Typography.Title level={3} style={{ marginBottom: 16, color: '#fff' }}>
              Upload a CSV file
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 24, color: '#b0b0b0' }}>
              Start by finding the <b>Download</b> or <b>Export</b> option on your app and export a
              CSV file.
              <br />
              <a href="#" style={{ color: '#4096ff' }}>
                Structure the CSV
              </a>{' '}
              to ensure the data is in the right format and upload it to begin.
            </Typography.Paragraph>
            <Upload.Dragger
              style={{
                marginBottom: 24,
                background: '#232324',
                border: '1px dashed #333',
                borderRadius: 8,
              }}
              accept=".csv"
              showUploadList={false}
              beforeUpload={file => {
                const reader = new FileReader();
                reader.onload = e => {
                  const text = e.target?.result as string;
                  setCsvText(text || '');
                  const parsed = Papa.parse<Record<string, any>>(text, {
                    header: true,
                    skipEmptyLines: true,
                  });
                  if (parsed.meta.fields) {
                    setCsvColumns(parsed.meta.fields);
                    // Reset mappings and checkboxes
                    setFieldMappings({});
                    setIncludeInImport(
                      Object.fromEntries(
                        (parsed.meta.fields as string[]).map((f: string) => [f, true])
                      )
                    );
                  }
                  setCsvRows(
                    Array.isArray(parsed.data) ? (parsed.data as Record<string, any>[]) : []
                  );
                };
                reader.readAsText(file);
                return false; // Prevent upload
              }}
            >
              <Button type="primary">Upload CSV file</Button>
            </Upload.Dragger>
            <Collapse
              ghost
              activeKey={csvSettingsOpen ? ['csv'] : []}
              onChange={keys => setCsvSettingsOpen(keys.includes('csv'))}
              style={{ marginBottom: 8 }}
            >
              <Collapse.Panel
                header={<span style={{ color: '#4096ff' }}>CSV file settings</span>}
                key="csv"
                style={{ color: '#fff', background: 'transparent' }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
                  <span>File encoding</span>
                  <Tooltip title="The character encoding of your CSV file.">
                    <InfoCircleOutlined style={{ color: '#4096ff' }} />
                  </Tooltip>
                  <Select
                    value={encoding}
                    onChange={setEncoding}
                    style={{ width: 120 }}
                    options={[
                      { value: 'US-ASCII', label: 'US-ASCII' },
                      { value: 'ISO-8859-1', label: 'ISO-8859-1' },
                      { value: 'UTF-8', label: 'UTF-8' },
                      { value: 'UTF-16BE', label: 'UTF-16BE' },
                      { value: 'UTF-16LE', label: 'UTF-16LE' },
                      { value: 'UTF-16', label: 'UTF-16' },
                    ]}
                  />
                  <span style={{ marginLeft: 32 }}>Delimiter</span>
                  <Tooltip title="The character that separates values in your CSV file.">
                    <InfoCircleOutlined style={{ color: '#4096ff' }} />
                  </Tooltip>
                  <Input
                    value={delimiter}
                    onChange={e => setDelimiter(e.target.value)}
                    style={{ width: 80 }}
                    placeholder=","
                  />
                </div>
              </Collapse.Panel>
            </Collapse>
            <Collapse
              ghost
              activeKey={configOpen ? ['config'] : []}
              onChange={keys => setConfigOpen(keys.includes('config'))}
            >
              <Collapse.Panel
                header={
                  <span style={{ color: '#4096ff' }}>Upload a configuration file (optional)</span>
                }
                key="config"
                style={{ color: '#fff', background: 'transparent' }}
              >
                <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 8 }}>
                  Adding a configuration file will bring in preferences selected in a previous
                  import such as mapped fields and users.{' '}
                  <a href="#" style={{ color: '#4096ff' }}>
                    Learn about using configuration files
                  </a>
                </Typography.Paragraph>
                <Upload disabled>
                  <Button disabled>Upload File</Button>
                </Upload>
              </Collapse.Panel>
            </Collapse>
          </>
        );
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'row', gap: 48, minHeight: 420 }}>
            {/* Left: Form */}
            <div style={{ flex: 1, maxWidth: 420 }}>
              <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
                Set up a space in Worklenz
              </Typography.Title>
              <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
                Your teamâ€™s data from <b>{source?.label || 'your app'}</b> will be imported into
                this space. Check if youâ€™re selecting the right Worklenz space, template, and
                space type as these options canâ€™t be modified later.
              </Typography.Paragraph>
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 20 }}>
                All fields are required
              </div>
              {/* Worklenz space select */}
              <div style={{ marginBottom: 20 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>
                  Worklenz space
                </Typography.Text>
                <Select
                  style={{ width: '100%', marginTop: 6 }}
                  value={spaceType}
                  onChange={setSpaceType}
                  styles={{ popup: { root: { background: '#23272f', color: '#fff' } } }}
                  optionLabelProp="label"
                >
                  <Select.Option value="software" label="Software space">
                    <span style={{ color: '#fff' }}>
                      &lt;/&gt; Software space{' '}
                      <span
                        style={{
                          background: '#0052CC',
                          color: '#fff',
                          borderRadius: 4,
                          fontSize: 12,
                          padding: '2px 8px',
                          marginLeft: 8,
                        }}
                      >
                        RECOMMENDED
                      </span>
                    </span>
                  </Select.Option>
                  <Select.Option value="business" label="Business space">
                    <span style={{ color: '#fff' }}>Business space</span>
                  </Select.Option>
                </Select>
              </div>
              {/* Template select */}
              <div style={{ marginBottom: 20 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>
                  Template
                </Typography.Text>
                <Select
                  style={{ width: '100%', marginTop: 6 }}
                  value={spaceTemplate}
                  onChange={setSpaceTemplate}
                  styles={{ popup: { root: { background: '#23272f', color: '#fff' } } }}
                  optionLabelProp="label"
                >
                  <Select.Option value="scrum" label="Scrum">
                    <span role="img" aria-label="Scrum" style={{ marginRight: 8 }}>
                      ðŸ‰
                    </span>
                    Scrum
                  </Select.Option>
                  <Select.Option value="kanban" label="Kanban">
                    <span role="img" aria-label="Kanban" style={{ marginRight: 8 }}>
                      ðŸ—‚ï¸
                    </span>
                    Kanban
                  </Select.Option>
                </Select>
              </div>
              {/* Space name input */}
              <div style={{ marginBottom: 20 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>
                  Space name
                </Typography.Text>
                <Input
                  style={{
                    width: '100%',
                    marginTop: 6,
                    background: '#18181a',
                    color: '#fff',
                    border: '1px solid #333',
                  }}
                  placeholder={t('importStep.spaceNamePlaceholder', 'Project name')}
                  value={spaceName}
                  onChange={e => setSpaceName(e.target.value)}
                />
              </div>
              {/* Show more (collapsible) */}
              <div style={{ marginBottom: 8 }}>
                <a style={{ color: '#4096ff', fontSize: 14 }} href="#">
                  &gt; Show more
                </a>
              </div>
            </div>
            {/* Right: Illustration (optional, can be replaced with SVG or image) */}
            <div
              style={{
                width: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 320,
                  height: 180,
                  background: '#18181a',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 16px 0 #b3c6e6',
                }}
              >
                {/* Placeholder for board illustration */}
                <svg
                  width="220"
                  height="120"
                  viewBox="0 0 220 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="0" y="0" width="220" height="120" rx="12" fill="#23272f" />
                  <rect x="16" y="20" width="36" height="80" rx="4" fill="#333" />
                  <rect x="60" y="20" width="36" height="80" rx="4" fill="#333" />
                  <rect x="104" y="20" width="36" height="80" rx="4" fill="#333" />
                  <rect x="148" y="20" width="36" height="80" rx="4" fill="#333" />
                  <rect x="192" y="20" width="12" height="80" rx="4" fill="#23272f" />
                  <rect x="20" y="28" width="28" height="12" rx="2" fill="#23272f" />
                  <rect x="64" y="28" width="28" height="12" rx="2" fill="#23272f" />
                  <rect x="108" y="28" width="28" height="12" rx="2" fill="#23272f" />
                  <rect x="152" y="28" width="28" height="12" rx="2" fill="#23272f" />
                </svg>
              </div>
            </div>
          </div>
        );
      case 2:
        // --- Map space fields step ---
        return (
          <div style={{ width: '100%' }}>
            <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
              Map space fields
            </Typography.Title>
            <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
              Weâ€™ve automatically mapped a few columns from the CSV file to{' '}
              <b>Worklenz fields</b>. Verify and{' '}
              <a href="#" style={{ color: '#4096ff' }}>
                map any remaining columns
              </a>
              . Map issue type field to bring in issue type values and map issue ID and parent
              fields to establish hierarchies.{' '}
              <a href="#" style={{ color: '#4096ff' }}>
                Read about mapping issue types
              </a>
            </Typography.Paragraph>
            {/* Date and time format options (collapsible) */}
            <Collapse
              ghost
              style={{ marginBottom: 16 }}
              bordered={false}
              expandIconPosition="start"
            >
              <Collapse.Panel
                header={
                  <span style={{ color: '#4096ff', fontSize: 15 }}>
                    &gt; Date and time format options
                  </span>
                }
                key="dateTimeFormat"
                style={{ background: 'transparent', border: 'none', padding: 0 }}
              >
                <div style={{ display: 'flex', gap: 24, marginBottom: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                      Date and time format<span style={{ color: '#ff4d4f' }}>*</span>
                    </Typography.Text>
                    <Input
                      placeholder="dd/MMM/yy h:mm a"
                      style={{
                        width: '100%',
                        background: '#18181a',
                        color: '#fff',
                        border: '1px solid #333',
                      }}
                    />
                    <Typography.Text style={{ color: '#888', fontSize: 12 }}>
                      e.g. dd/MMM/yy h:mm a
                    </Typography.Text>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                      Locale
                    </Typography.Text>
                    <Select defaultValue="en" style={{ width: '100%' }}>
                      <Select.Option value="en">English (US)</Select.Option>
                      <Select.Option value="fr">French (FR)</Select.Option>
                      <Select.Option value="de">German (DE)</Select.Option>
                      {/* Add more locales as needed */}
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                      Timezone
                    </Typography.Text>
                    <Select defaultValue="colombo" style={{ width: '100%' }}>
                      <Select.Option value="colombo">Asia/Colombo (UTC+5:30)</Select.Option>
                      <Select.Option value="newyork">America/New_York (UTC-5)</Select.Option>
                      <Select.Option value="london">Europe/London (UTC+0)</Select.Option>
                      {/* Add more timezones as needed */}
                    </Select>
                  </div>
                </div>
              </Collapse.Panel>
            </Collapse>
            {/* Search and filter row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <Input
                placeholder="Search columns in CSV"
                style={{
                  width: 260,
                  background: '#18181a',
                  color: '#fff',
                  border: '1px solid #333',
                }}
              />
              <Select defaultValue="all" style={{ width: 120 }}>
                <Select.Option value="all">Fields: All</Select.Option>
                <Select.Option value="mapped">Mapped</Select.Option>
                <Select.Option value="unmapped">Unmapped</Select.Option>
              </Select>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: 16,
                maxHeight: 420,
                overflowY: 'auto',
                overflowX: 'auto',
                paddingRight: 6,
                paddingBottom: 12,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: '#b0b0b0',
                  fontWeight: 500,
                  fontSize: 14,
                  marginBottom: 4,
                }}
              >
                <span style={{ flex: 2, paddingLeft: 8 }}>Columns in CSV</span>
                <span style={{ flex: 2 }}>Worklenz fields</span>
                <span style={{ width: 140, textAlign: 'center' }}>Include in import</span>
              </div>
              {/* Mapping rows for each CSV column */}
              {csvColumns.length === 0 ? (
                <div style={{ color: '#888', margin: '24px 0' }}>
                  Upload a CSV file to map fields.
                </div>
              ) : (
                csvColumns.map(col => (
                  <div
                    key={col}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#23272f',
                      borderRadius: 6,
                      marginBottom: 4,
                      minHeight: 44,
                    }}
                  >
                    <span style={{ flex: 2, paddingLeft: 8, color: '#fff' }}>{col}</span>
                    <span style={{ flex: 2 }}>
                      <AutoComplete
                        placeholder="Select or type a field to map"
                        style={{ width: '100%' }}
                        value={fieldMappings[col] || ''}
                        onChange={val => setFieldMappings(m => ({ ...m, [col]: val }))}
                        options={worklenzFieldOptions}
                        allowClear
                        filterOption={(inputValue, option) =>
                          option?.label?.toLowerCase().includes(inputValue.toLowerCase()) || false
                        }
                      />
                    </span>
                    <span style={{ width: 140, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={includeInImport[col] !== false}
                        onChange={e => setIncludeInImport(i => ({ ...i, [col]: e.target.checked }))}
                        style={{ accentColor: '#4096ff', width: 18, height: 18 }}
                      />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 3:
        // Map values to work types step
        const csvValues = statusValues;
        const workTypesList = workTypeOptions;
        const filteredValues = csvValues.filter(
          v =>
            v.toLowerCase().includes(searchValue.toLowerCase()) &&
            (filter === 'all' || (filter === 'mapped' ? workTypeMapping[v] : !workTypeMapping[v]))
        );

        const emptyValuesMessage = statusColumnKey
          ? t('importStep.noStatusValuesFound', 'No values found in the mapped Status column.')
          : t('importStep.selectStatusColumnPrompt', 'Map a CSV column to Status to see values.');

        return (
          <div style={{ width: '100%' }}>
            <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
              {t('importStep.mapValues', 'Map values to work types')}
            </Typography.Title>
            <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
              {t(
                'importStep.mapValuesHelp',
                'Build more structure into your space by mapping values in your Status column to Worklenz statuses.'
              )}{' '}
              <a href="#" style={{ color: '#4096ff' }}>
                {t('importStep.mapValuesDocs', 'Read about mapping work types')}
              </a>
            </Typography.Paragraph>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <Input
                placeholder="Search values"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                style={{
                  width: 220,
                  background: '#18181a',
                  color: '#fff',
                  border: '1px solid #333',
                }}
              />
              <Select
                value={filter}
                onChange={setFilter}
                style={{ width: 120 }}
                styles={{ popup: { root: { background: '#23272f', color: '#fff' } } }}
              >
                <Select.Option value="all">Values: All</Select.Option>
                <Select.Option value="mapped">Mapped</Select.Option>
                <Select.Option value="unmapped">Unmapped</Select.Option>
              </Select>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#b0b0b0',
                fontWeight: 500,
                fontSize: 15,
                marginBottom: 8,
              }}
            >
              <span style={{ flex: 2, paddingLeft: 8 }}>
                <span role="img" aria-label="values" style={{ marginRight: 8 }}>
                  ðŸ“¦
                </span>
                Values in the selected column
              </span>
              <span style={{ flex: 1 }}></span>
              <span style={{ flex: 2, display: 'flex', alignItems: 'center' }}>
                <span
                  role="img"
                  aria-label="work types"
                  style={{ marginRight: 8, color: '#4096ff' }}
                >
                  ðŸ·ï¸
                </span>
                Worklenz work types
              </span>
            </div>
            {filteredValues.length === 0 ? (
              <div style={{ color: '#888', margin: '24px 0' }}>{emptyValuesMessage}</div>
            ) : (
              filteredValues.map(value => (
                <div
                  key={value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#18181a',
                    borderRadius: 8,
                    marginBottom: 8,
                    minHeight: 44,
                  }}
                >
                  <span style={{ flex: 2, paddingLeft: 8, color: '#fff', fontSize: 16 }}>
                    {value}
                  </span>
                  <span style={{ flex: 1, textAlign: 'center', color: '#b0b0b0', fontSize: 20 }}>
                    &rarr;
                  </span>
                  <span style={{ flex: 2 }}>
                    <Select
                      value={workTypeMapping[value] || undefined}
                      onChange={val => setWorkTypeMapping(m => ({ ...m, [value]: val }))}
                      placeholder="Select work type"
                      style={{
                        width: '100%',
                        background: '#23272f',
                        color: '#fff',
                        border: '1px solid #333',
                      }}
                      styles={{ popup: { root: { background: '#23272f', color: '#fff' } } }}
                      popupRender={menu => (
                        <>
                          <div
                            style={{
                              padding: '8px 12px',
                              color: '#b0b0b0',
                              fontWeight: 500,
                              fontSize: 13,
                            }}
                          >
                            MAP TO A SUGGESTED WORK TYPE
                          </div>
                          {menu}
                          <div style={{ borderTop: '1px solid #333', margin: '8px 0' }} />
                          <div
                            style={{ padding: '8px 12px', color: '#4096ff', cursor: 'pointer' }}
                            onClick={() => {
                              setWorkTypeMapping(m => {
                                const copy = { ...m };
                                delete copy[value];
                                return copy;
                              });
                            }}
                          >
                            Clear selection
                          </div>
                        </>
                      )}
                      optionLabelProp="label"
                    >
                      {workTypesList.map(wt => (
                        <Select.Option key={wt.key} value={wt.key} label={wt.label}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {wt.icon}
                            <span style={{ color: '#fff' }}>{wt.label}</span>
                            <span style={{ color: '#b0b0b0', fontSize: 13, marginLeft: 8 }}>
                              {t('importStep.statusLevel', 'Level')} {wt.level}
                            </span>
                          </span>
                        </Select.Option>
                      ))}
                    </Select>
                  </span>
                </div>
              ))
            )}
          </div>
        );
      case 4:
        // Move users step
        // Real user detection: check for user-related columns in the CSV
        const userColumnKeywords = ['assignee', 'reporter', 'email', 'user', 'username'];
        const userColumns = csvColumns.filter(col =>
          userColumnKeywords.some(keyword => col.toLowerCase().includes(keyword))
        );
        const noUsers = userColumns.length === 0;

        // Extract unique user values from the CSV for userColumns
        // For now, we don't have the parsed CSV rows in state, so we'll mock with empty array if not available
        // TODO: Replace with actual parsed CSV data if available
        let userRows: string[] = [];
        if (!noUsers && window && (window as any).parsedCsvRows) {
          // If parsedCsvRows is globally available (for dev/testing)
          const parsedRows = (window as any).parsedCsvRows as Record<string, any>[];
          const usersSet = new Set<string>();
          parsedRows.forEach(row => {
            userColumns.forEach(col => {
              if (row[col] && typeof row[col] === 'string') {
                usersSet.add(row[col]);
              }
            });
          });
          userRows = Array.from(usersSet);
        }

        return (
          <div style={{ width: '100%' }}>
            <Typography.Title level={3} style={{ color: '#fff', marginBottom: 16 }}>
              Move users to Worklenz
            </Typography.Title>
            {noUsers ? (
              <div
                style={{
                  background: '#19345c',
                  borderRadius: 8,
                  padding: 24,
                  color: '#fff',
                  marginBottom: 24,
                  maxWidth: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 20, marginRight: 10, color: '#60a5fa' }}>â„¹ï¸</span>
                  <span style={{ fontWeight: 600, fontSize: 18 }}>
                    There are no users in the CSV file
                  </span>
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 15, marginBottom: 8 }}>
                  You can proceed with the import by selecting Next or restart the import by
                  uploading a CSV file with user information. If you choose to proceed without
                  adding user information:
                </div>
                <ul style={{ color: '#fff', fontSize: 15, marginLeft: 24, marginBottom: 0 }}>
                  <li>Assignee and reporter fields will be unassigned.</li>
                  <li>User @mentions in comments will be converted to plain text.</li>
                  <li>Commenter names will change to Anonymous.</li>
                </ul>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <div
                    style={{
                      background: addUsers ? '#22c55e' : '#23272f',
                      borderRadius: 16,
                      width: 48,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: addUsers ? 'flex-end' : 'flex-start',
                      padding: 4,
                      cursor: 'pointer',
                      marginRight: 12,
                      transition: 'background 0.2s',
                    }}
                    onClick={() => setAddUsers(v => !v)}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 1px 4px #0002',
                        transition: 'all 0.2s',
                      }}
                    />
                  </div>
                  <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 18 }}>
                    Add users into your space
                  </span>
                </div>
                <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 20 }}>
                  Enter a valid email address next to the user information to add a user to the
                  space. Users without a corresponding email address wonâ€™t be imported.
                </Typography.Paragraph>
                {/* Table header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: '#b0b0b0',
                    fontWeight: 500,
                    fontSize: 15,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ flex: 2, paddingLeft: 8 }}>
                    <span style={{ marginRight: 8 }}>ðŸ“„</span>Users in CSV ({userRows.length})
                  </span>
                  <span style={{ width: 40 }}></span>
                  <span style={{ flex: 3 }}>
                    <span style={{ marginRight: 8 }}>ðŸ›«</span>Users moving to Worklenz (0)
                  </span>
                </div>
                {/* User mapping rows */}
                {userRows.map((user, idx) => (
                  <div
                    key={user + idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#23272f',
                      borderRadius: 6,
                      marginBottom: 4,
                      minHeight: 44,
                    }}
                  >
                    <span style={{ flex: 2, paddingLeft: 8, color: '#fff' }}>{user}</span>
                    <span
                      style={{ width: 40, textAlign: 'center', color: '#4096ff', fontSize: 20 }}
                    >
                      &rarr;
                    </span>
                    <span style={{ flex: 3 }}>
                      <Input
                        placeholder="Enter email"
                        value={userEmails[user] || ''}
                        onChange={e =>
                          setUserEmails(emails => ({ ...emails, [user]: e.target.value }))
                        }
                        style={{
                          width: '100%',
                          background: '#18181a',
                          color: '#fff',
                          border: '1px solid #333',
                        }}
                      />
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      case 5:
        // Review details step
        const reviewSpaceName = spaceName || t('importStep.defaultSpaceName', 'Imported space');
        const reviewSpaceType = spaceType || 'software';
        const mappedFields = Object.values(fieldMappings).filter(Boolean).length;
        const totalFields = csvColumns.length;
        const workTypes = 1; // TODO: get from mapping logic
        const usersCount = Object.values(userEmails).filter(Boolean).length;
        const workItems = 9993; // TODO: get from CSV row count
        return (
          <div style={{ width: '100%' }}>
            <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
              Review space details
            </Typography.Title>
            <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 24 }}>
              Weâ€™re ready to import your teamâ€™s data. Hereâ€™s a summary of whatâ€™s being
              imported into Worklenz.
              <br />
              Confirm the details before starting the import.
            </Typography.Paragraph>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
              {/* Space card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#18181a',
                  borderRadius: 12,
                  padding: 20,
                  gap: 20,
                }}
              >
                <img
                  src="https://img.icons8.com/fluency/48/000000/trello.png"
                  alt="space"
                  style={{ width: 48, height: 48 }}
                />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
                    1 Worklenz space: {reviewSpaceName}
                  </div>
                  <div style={{ color: '#b0b0b0', fontSize: 15 }}>
                    A team-managed software space ({reviewSpaceType}) will be created.
                  </div>
                </div>
              </div>
              {/* Fields card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#18181a',
                  borderRadius: 12,
                  padding: 20,
                  gap: 20,
                }}
              >
                <img
                  src="https://img.icons8.com/fluency/48/000000/columns.png"
                  alt="fields"
                  style={{ width: 48, height: 48 }}
                />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
                    {mappedFields}/{totalFields} fields
                  </div>
                  <div style={{ color: '#b0b0b0', fontSize: 15 }}>
                    {mappedFields} columns will be mapped to existing Worklenz fields.
                  </div>
                </div>
              </div>
              {/* Work type card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#18181a',
                  borderRadius: 12,
                  padding: 20,
                  gap: 20,
                }}
              >
                <img
                  src="https://img.icons8.com/fluency/48/000000/task.png"
                  alt="work type"
                  style={{ width: 48, height: 48 }}
                />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
                    {workTypes} work type
                  </div>
                  <div style={{ color: '#b0b0b0', fontSize: 15 }}>
                    Since no values were mapped to Worklenz work types, all work items will be
                    mapped to Task (level 0) by default.
                  </div>
                </div>
              </div>
              {/* Users card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#18181a',
                  borderRadius: 12,
                  padding: 20,
                  gap: 20,
                }}
              >
                <img
                  src="https://img.icons8.com/fluency/48/000000/add-user-group-man-man.png"
                  alt="users"
                  style={{ width: 48, height: 48 }}
                />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
                    {usersCount === 0 ? 'No users' : `${usersCount} users`}
                  </div>
                  <div style={{ color: '#b0b0b0', fontSize: 15 }}>
                    {usersCount === 0
                      ? "You haven't added users to the space. Assignee and reporter fields will be unassigned and user @mentions in comments will be converted to plain text."
                      : 'Users will be added to the space.'}
                  </div>
                </div>
              </div>
              {/* Work items card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#18181a',
                  borderRadius: 12,
                  padding: 20,
                  gap: 20,
                }}
              >
                <img
                  src="https://img.icons8.com/fluency/48/000000/list.png"
                  alt="work items"
                  style={{ width: 48, height: 48 }}
                />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>
                    {workItems} work items
                  </div>
                  <div style={{ color: '#b0b0b0', fontSize: 15 }}>
                    Each row of the CSV data will be imported as a work item.{' '}
                    <a href="#" style={{ color: '#4096ff' }}>
                      What is a work item?
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 32, color: '#8fa7d3', fontSize: 15 }}>
              <a href="#" style={{ color: '#8fa7d3', textDecoration: 'underline' }}>
                Download a configuration file
              </a>{' '}
              to use the same space preferences in your next import.
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  const showIllustration = !(integrationType === 'direct' && step === 2);

  const renderAuthGate = () => {
    if (lowerKey === 'asana') {
      return (
        <div
          style={{
            width: 820,
            height: 245,
            padding: '40px 40px',
            borderRadius: 10,
            background: '#067EFC08',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <Typography.Title level={2} style={{ color: themeToken.colorText, margin: 0 }}>
            {t('auth.asanaTitle', 'Connect Asana to import')}
          </Typography.Title>
          <Typography.Paragraph
            style={{ color: themeToken.colorTextSecondary, fontSize: 16, margin: 0 }}
          >
            {t(
              'auth.asanaBody',
              "We'll open Asana's consent screen to grant access to your projects and tasks."
            )}
          </Typography.Paragraph>
          {authError && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {authError}
            </Typography.Text>
          )}
          <Button type="primary" size="middle" loading={authLoading} onClick={handleAsanaAuth}>
            {t('auth.asanaCta', 'Allow Permission')}
          </Button>
          <div style={{ color: themeToken.colorTextSecondary }}>
            {t('auth.asanaHint', 'Opens a new tab to Asana')}
          </div>
        </div>
      );
    }

    if (lowerKey === 'monday') {
      return (
        <div style={{ padding: 48, background: themeToken.colorBgLayout, height: '100%' }}>
          <Typography.Title level={4} style={{ color: themeToken.colorText, marginBottom: 8 }}>
            {t('auth.mondayTitle', 'Enter your Monday token')}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 16 }}>
            {t(
              'auth.mondayBody',
              'Paste a personal access token to let Worklenz fetch boards and items for import.'
            )}
          </Typography.Paragraph>
          <Input.Password
            placeholder={t('auth.mondayPlaceholder', 'Paste your Monday token')}
            value={mondayToken}
            onChange={e => setMondayToken(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          {authError && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {authError}
            </Typography.Text>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button
              type="primary"
              disabled={!mondayToken.trim()}
              loading={authLoading}
              onClick={handleMondayValidate}
            >
              {t('auth.mondaySubmit', 'Continue')}
            </Button>
          </div>
        </div>
      );
    }

    if (lowerKey === 'trello') {
      return (
        <div style={{ padding: 48, background: themeToken.colorBgLayout, height: '100%' }}>
          <Typography.Title level={4} style={{ color: themeToken.colorText, marginBottom: 8 }}>
            {t('auth.trelloTitle', 'Connect Trello to import')}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 16 }}>
            {t(
              'auth.trelloBody',
              'Enter your Trello API key and token so Worklenz can fetch your boards.'
            )}
          </Typography.Paragraph>
          <Input
            placeholder={t('auth.trelloKeyPlaceholder', 'Enter your Trello API key')}
            value={trelloKey}
            onChange={e => setTrelloKey(e.target.value)}
            style={{ marginBottom: 12 }}
            allowClear
          />
          <Input.Password
            placeholder={t('auth.trelloTokenPlaceholder', 'Enter your Trello token')}
            value={trelloToken}
            onChange={e => setTrelloToken(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          {authError && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {authError}
            </Typography.Text>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button
              type="primary"
              disabled={!trelloKey.trim() || !trelloToken.trim()}
              loading={authLoading}
              onClick={handleTrelloValidate}
            >
              {t('auth.trelloSubmit', 'Continue')}
            </Button>
          </div>
        </div>
      );
    }

    if (lowerKey === 'clickup') {
      return (
        <div style={{ padding: 48, background: themeToken.colorBgLayout, height: '100%' }}>
          <Typography.Title level={2} style={{ color: themeToken.colorText, marginBottom: 12 }}>
            {t('auth.clickupTitle', 'Connect ClickUp workspace')}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, fontSize: 16 }}>
            {t(
              'auth.clickupBody',
              'Choose the ClickUp workspace to connect. Weâ€™ll request access to read your spaces, folders, lists, and tasks for import.'
            )}
          </Typography.Paragraph>
          <Input.Password
            placeholder={t('auth.tokenPlaceholder', 'Paste your access token')}
            value={clickupToken}
            onChange={e => setClickupToken(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <label
            style={{ color: themeToken.colorTextSecondary, display: 'block', marginBottom: 8 }}
          >
            {t('auth.clickupWorkspace', 'Workspace')}
          </label>
          <Select
            placeholder={t('auth.clickupSelect', 'Select workspace')}
            value={selectedClickupSpace || undefined}
            onChange={v => setSelectedClickupSpace(v)}
            style={{ width: 320, marginBottom: 16 }}
            options={clickupTeams.flatMap(team =>
              team.spaces.map(space => ({
                value: space.id,
                label: `${team.name} â€¢ ${space.name}`,
              }))
            )}
          />
          <Select
            placeholder={t('auth.clickupSelect', 'Select workspace')}
            value={selectedClickupList || undefined}
            onChange={v => setSelectedClickupList(v)}
            style={{ width: 320, marginBottom: 16 }}
            options={clickupTeams
              .flatMap(team => team.spaces)
              .filter(space => !selectedClickupSpace || space.id === selectedClickupSpace)
              .flatMap(space =>
                space.lists.map(list => ({
                  value: list.id,
                  label: `${space.name} â€¢ ${list.name}`,
                }))
              )}
          />
          {authError && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {authError}
            </Typography.Text>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button
              type="primary"
              disabled={!clickupToken.trim()}
              loading={authLoading}
              onClick={handleClickupValidate}
            >
              {t('auth.clickupSubmit', 'Select workspace')}
            </Button>
          </div>
        </div>
      );
    }

    if (isJira) {
      // Align JIRA wrapper styling with Asana: light blue-tinted background container.
      return (
        <div
          style={{
            padding: 48,
            background: '#2684FF08',
            height: '100%',
            borderRadius: 12,
          }}
        >
          <Typography.Title level={2} style={{ color: themeToken.colorText, marginBottom: 12 }}>
            {t('auth.jiraTitle', 'Connect JIRA')}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, fontSize: 16 }}>
            {t(
              'auth.jiraBody',
              "Enter your JIRA credentials to import projects and issues. You'll need an API token from your JIRA account."
            )}
          </Typography.Paragraph>

          <div style={{ marginBottom: 12 }}>
            <label style={{ color: themeToken.colorText, display: 'block', marginBottom: 4 }}>
              {t('auth.jiraEmail', 'Email')}
            </label>
            <Input
              placeholder={t('auth.jiraEmailPlaceholder', 'your-email@company.com')}
              value={jiraEmail}
              onChange={e => setJiraEmail(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ color: themeToken.colorText, display: 'block', marginBottom: 4 }}>
              {t('auth.jiraDomain', 'Domain')}
            </label>
            <Input
              placeholder={t('auth.jiraDomainPlaceholder', 'yourcompany.atlassian.net')}
              value={jiraDomain}
              onChange={e => setJiraDomain(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ color: themeToken.colorText, display: 'block', marginBottom: 4 }}>
              {t('auth.jiraToken', 'API Token')}
            </label>
            <Input.Password
              placeholder={t('auth.jiraTokenPlaceholder', 'Paste your JIRA API token')}
              value={jiraToken}
              onChange={e => setJiraToken(e.target.value)}
            />
          </div>

          {authError && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {authError}
            </Typography.Text>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button
              type="primary"
              disabled={!jiraToken.trim() || !jiraEmail.trim() || !jiraDomain.trim()}
              loading={authLoading}
              onClick={handleJiraValidate}
            >
              {t('auth.jiraSubmit', 'Connect')}
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderCompletionContent = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        width: '100%',
        maxWidth: 780,
        margin: '0 auto',
      }}
    >
      <img
        src="https://images.ctfassets.net/rz1oowkt5gyp/2kQEtpSt0aRvFV8aXrudQK/a8a1ea83b9e8b9d68ebf4598d2d9961c/IMPORT_COMPLETED_MAP.png"
        alt="Importing"
        style={{ maxWidth: 640, width: '100%', height: 'auto' }}
      />
      <div style={{ textAlign: 'center', maxWidth: 620 }}>
        <Typography.Title level={3} style={{ marginBottom: 10 }}>
          {t('importStep.importingHeadline', "We're mapping out the new space")}
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 14, fontSize: 16 }}>
          {t(
            'importStep.importingSubhead',
            "Take a quick break and we'll do the rest. We'll take you to the space once it's ready."
          )}
        </Typography.Paragraph>
        <ul style={{ textAlign: 'left', margin: '0 auto 18px', maxWidth: 360, fontSize: 15 }}>
          <li>{t('importStep.importingTask1', 'Importing project data')}</li>
          <li>{t('importStep.importingTask2', 'Setting up user profiles')}</li>
          <li>{t('importStep.importingTask3', 'Creating a new space')}</li>
        </ul>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button size="large" onClick={handleStartNewImport}>
            {t('importStep.startNew', 'Start a new import')}
          </Button>
          <Button type="link" size="large">
            {t('importStep.feedback', 'Give feedback')}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      centered
      open={open}
      onCancel={onClose}
      footer={null}
      width={modalDims.width}
      style={{
        top: 40,
      }}
      styles={{
        content: {
          borderRadius: 20,
          background: '#fff',
          overflow: 'hidden',
        },
        body: {
          minHeight: modalDims.height,
          maxHeight: modalDims.height,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
        },
      }}
    >
      <div
        className="import-modal-body"
        style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}
      >
        <div className="heading" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {showIllustration && source?.icon && (
            <div style={{ display: 'grid', placeItems: 'center', fontSize: 36 }}>{source.icon}</div>
          )}
          <Typography.Title level={3} style={{ margin: 0, fontSize: 26 }}>
            {source.label}
          </Typography.Title>
        </div>

        {!showCompletion && (
          <div
            className="stepper"
            style={{
              padding: '0 4px',
              marginBottom: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '100%', maxWidth: modalDims.stepperMaxWidth }}>
              <Steps
                direction="horizontal"
                current={step}
                items={steps.map(title => ({ title }))}
                onChange={current => {
                  if (navigationDisabled) return;
                  setStep(current);
                }}
              />
            </div>
          </div>
        )}

        <div
          className="content"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {showCompletion ? (
            <div
              className="content-body"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 16px',
              }}
            >
              {renderCompletionContent()}
            </div>
          ) : authNeeded && !authCompleted ? (
            <div className="content-body" style={{ height: '100%', padding: 0 }}>
              {renderAuthGate()}
            </div>
          ) : (
            <>
              <div className="content-body" style={{ flex: 1 }}>
                {renderStepContent()}
              </div>
              <div
                className="content-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 12,
                  marginTop: 'auto',
                  padding: '12px 0 4px',
                }}
              >
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={handleBack}
                  disabled={step === 0}
                >
                  {t('common.previous', 'Previous')}
                </Button>
                <Button
                  type="primary"
                  icon={step === totalSteps - 1 ? undefined : <ArrowRightOutlined />}
                  onClick={step === totalSteps - 1 ? handleFinish : handleNext}
                  loading={isImporting && step === totalSteps - 1}
                  disabled={
                    navigationDisabled ||
                    isImporting ||
                    (step === totalSteps - 1 &&
                      integrationType === 'csv' &&
                      (!csvText.trim() || !spaceName.trim()))
                  }
                >
                  {step === totalSteps - 1
                    ? integrationType === 'direct'
                      ? t('importStep.importCta', 'Import')
                      : t('common.finish', 'Finish')
                    : t('common.next', 'Next')}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
export default ImportSourceModal;
