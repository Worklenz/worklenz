import React from 'react';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  Modal,
  Button,
  Card,
  Typography,
  Steps,
  message,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  createImportJob,
  autoImportFields,
  autoImportHierarchy,
  updateImportSource,
} from '@/api/imports';
import type { ImportJob } from '@/api/imports';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectStatus } from '@/types/project/projectStatus.types';
import { AuthGateContent } from './import-source-modal/components/AuthGateContent';
import { ImportCompletionContent } from './import-source-modal/components/ImportCompletionContent';
import { ImportStepContent } from './import-source-modal/components/ImportStepContent';
import { AUTH_GATE_APPS, DIRECT_INTEGRATION_APPS, isJiraProvider } from './import-source-modal/constants';
import { useImportAuthHandlers } from './import-source-modal/hooks/useImportAuthHandlers';
import { useImportDerivedData } from './import-source-modal/hooks/useImportDerivedData';
import { useImportFinishHandler } from './import-source-modal/hooks/useImportFinishHandler';
import { useImportJobHelpers } from './import-source-modal/hooks/useImportJobHelpers';
import { ClickupTeam, ImportSourceModalProps } from './import-source-modal/types';
import { parseCsvText } from './import-source-modal/utils';
import './import-export-settings.css';

const JiraIcon = () => (
  <svg width="28" height="28" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="jiraGrad1SingleModal" x1="98.031%" x2="58.888%" y1=".161%" y2="40.766%">
        <stop offset="18%" stopColor="#0052CC" />
        <stop offset="100%" stopColor="#2684FF" />
      </linearGradient>
      <linearGradient id="jiraGrad2SingleModal" x1="100.665%" x2="55.402%" y1=".455%" y2="44.727%">
        <stop offset="18%" stopColor="#0052CC" />
        <stop offset="100%" stopColor="#2684FF" />
      </linearGradient>
    </defs>
    <path
      fill="#2684FF"
      d="M244.658 0H121.707a55.5 55.5 0 0 0 55.502 55.502h22.649V77.37c.02 30.625 24.841 55.447 55.466 55.467V10.666C255.324 4.777 250.55 0 244.658 0"
    />
    <path
      fill="url(#jiraGrad1SingleModal)"
      d="M183.822 61.262H60.872c.019 30.625 24.84 55.447 55.466 55.467h22.649v21.938c.039 30.625 24.877 55.43 55.502 55.43V71.93c0-5.891-4.776-10.667-10.667-10.667"
    />
    <path
      fill="url(#jiraGrad2SingleModal)"
      d="M122.951 122.489H0c0 30.653 24.85 55.502 55.502 55.502h22.72v21.867c.02 30.597 24.798 55.408 55.396 55.466V133.156c0-5.891-4.776-10.667-10.667-10.667"
    />
  </svg>
);

const AsanaIcon = () => (
  <svg width="28" height="28" viewBox="0 0 256 237" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#F06A6A"
      d="M200.325 125.27c-30.749 0-55.675 24.927-55.675 55.677s24.926 55.677 55.675 55.677S256 211.696 256 180.947c0-30.75-24.926-55.677-55.675-55.677m-144.65.005C24.927 125.275 0 150.197 0 180.947s24.927 55.677 55.675 55.677c30.75 0 55.678-24.928 55.678-55.677c0-30.75-24.928-55.672-55.678-55.672m128-69.6c0 30.75-24.927 55.68-55.674 55.68c-30.75 0-55.676-24.93-55.676-55.68C72.325 24.928 97.25 0 128 0c30.747 0 55.673 24.93 55.673 55.674"
    />
  </svg>
);

const TrelloIcon = () => (
  <svg width="28" height="28" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="trelloGradSingleModal" x1="50%" x2="50%" y1="0%" y2="100%">
        <stop offset="0%" stopColor="#0091E6" />
        <stop offset="100%" stopColor="#0079BF" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" fill="url(#trelloGradSingleModal)" rx="25" />
    <rect width="78.08" height="112" x="144.64" y="33.28" fill="#FFF" rx="12" />
    <rect width="78.08" height="176" x="33.28" y="33.28" fill="#FFF" rx="12" />
  </svg>
);

const MondayIcon = () => (
  <svg
    className="import-source-icon-wide"
    width="34"
    height="20"
    viewBox="0 0 256 156"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#F62B54"
      d="M31.846 153.489a31.97 31.97 0 0 1-27.86-16.167a30.91 30.91 0 0 1 .875-31.823l57.373-90.096A31.99 31.99 0 0 1 90.556.015a31.93 31.93 0 0 1 27.41 16.896c5.349 10.113 4.68 22.28-1.725 31.774L58.904 138.78a31.98 31.98 0 0 1-27.058 14.709"
    />
    <path
      fill="#FFCC00"
      d="M130.256 153.488c-11.572 0-22.22-6.187-27.812-16.13a30.81 30.81 0 0 1 .875-31.737l57.264-89.89A31.94 31.94 0 0 1 188.93.016c11.669.255 22.244 6.782 27.592 16.993a30.81 30.81 0 0 1-2.066 31.92l-57.252 89.889a31.93 31.93 0 0 1-26.948 14.671"
    />
    <ellipse cx="226.466" cy="125.324" fill="#00CA72" rx="29.538" ry="28.918" />
  </svg>
);

const AVAILABLE_IMPORT_SOURCES = [
  { key: 'asana', icon: <AsanaIcon />, label: 'Asana', order: 1, comingSoon: false },
  { key: 'jira-software', icon: <JiraIcon />, label: 'Jira', order: 0, comingSoon: false },
  { key: 'trello', icon: <TrelloIcon />, label: 'Trello', order: 2, comingSoon: true },
  { key: 'monday', icon: <MondayIcon />, label: 'Monday.com', order: 3, comingSoon: true },
  {
    key: 'csv',
    icon: (
      <img
        src="/file-types/csv.png"
        alt="CSV"
        style={{ width: 36, height: 36, objectFit: 'contain' }}
      />
    ),
    label: 'CSV',
    order: 99,
    comingSoon: false,
  },
];

export const ImportSourceModal: React.FC<ImportSourceModalProps> = ({ open, onClose, source }) => {
  const [selectedSource, setSelectedSource] = React.useState(source);
  const activeSource = source || selectedSource;

  const { t } = useTranslation('settings/import-export');
  const { token: themeToken } = theme.useToken();
  const tt = React.useCallback(
    (key: string, defaultValue: string, options?: Record<string, unknown>) =>
      t(key, { defaultValue, ...(options || {}) }),
    [t]
  );

  // --- Dynamic import flow state ---
  const lowerKey = activeSource?.key?.toLowerCase() || '';
  const isJira = isJiraProvider(lowerKey);
  const integrationType = DIRECT_INTEGRATION_APPS.includes(lowerKey as any) ? 'direct' : 'csv';
  const authNeeded = AUTH_GATE_APPS.includes(lowerKey as any);
  const providerForApi = isJira
    ? 'jira'
    : DIRECT_INTEGRATION_APPS.includes(lowerKey as any)
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
  const [clickupTeams, setClickupTeams] = React.useState<ClickupTeam[]>([]);
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
    if (!open) return;
    setSelectedSource(source);
  }, [open, source]);

  React.useEffect(() => {
    if (!activeSource) return;

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
    setSpaceName(activeSource.label ? `${activeSource.label} import` : '');
    setSpaceType('');
    setSpaceTemplate('');
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
  }, [activeSource, authNeeded, integrationType, providerForApi]);

  // Steps for each flow
  const steps =
    integrationType === 'direct'
      ? [
        tt('steps.selectList', 'Select list'),
        tt('steps.createProject', 'Create project'),
        tt('steps.reviewImport', 'Review Details & Import'),
      ]
      : [
        tt('steps.uploadCsv', 'Upload CSV'),
        tt('steps.setupProject', 'Set up project'),
        tt('steps.mapFields', 'Map fields'),
        tt('steps.mapValues', 'Map statuses'),
        tt('steps.moveUsers', 'Move users'),
        tt('steps.reviewDetails', 'Review details'),
      ];

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
  const [encoding, setEncoding] = React.useState('UTF-8');

  // State for CSV columns and mapping
  const [csvColumns, setCsvColumns] = React.useState<string[]>([]);
  const [csvText, setCsvText] = React.useState<string>('');
  const [csvRows, setCsvRows] = React.useState<Record<string, any>[]>([]);
  const uploadedCsvFileRef = React.useRef<File | null>(null);
  const [fieldMappings, setFieldMappings] = React.useState<Record<string, string>>({});
  const [includeInImport, setIncludeInImport] = React.useState<Record<string, boolean>>({});
  // Delimiter for CSV parsing
  const [delimiter, setDelimiter] = React.useState<string>('');

  // Search/filter for mapping step
  const [searchValue, setSearchValue] = React.useState<string>('');
  const [filter, setFilter] = React.useState<string>('all');

  // Status value mapping step
  const [statusValueMapping, setStatusValueMapping] = React.useState<Record<string, string>>({});

  // Move users step state
  const [addUsers, setAddUsers] = React.useState<boolean>(true);
  const [userEmails, setUserEmails] = React.useState<Record<string, string>>({});

  // Importing state
  const [isImporting, setIsImporting] = React.useState<boolean>(false);
  const [autoMappingRunning, setAutoMappingRunning] = React.useState(false);
  const [spaceName, setSpaceName] = React.useState<string>('');
  const [spaceType, setSpaceType] = React.useState<string>('');
  const [spaceTemplate, setSpaceTemplate] = React.useState<string>('');
  const [defaultProjectStatusId, setDefaultProjectStatusId] = React.useState<string | null>(null);
  const [worklenzStatuses, setWorklenzStatuses] = React.useState<IProjectStatus[]>([]);

  // For Jira direct imports, default the target Worklenz project name to the selected Jira project name.
  // Preserve manual edits by only auto-updating when the current value still looks auto-generated.
  React.useEffect(() => {
    if (!open) return;
    if (!isJira || integrationType !== 'direct') return;
    if (!selectedJiraProject) return;

    const jiraProjectName = (
      jiraProjects.find(p => p.key === selectedJiraProject)?.name || ''
    ).trim();
    if (!jiraProjectName) return;

    const defaultName = activeSource?.label ? `${activeSource.label} import` : '';
    const currentName = (spaceName || '').trim();
    const looksAutoGenerated =
      !currentName ||
      currentName === defaultName ||
      jiraProjects.some(p => (p.name || '').trim() === currentName);

    if (looksAutoGenerated && currentName !== jiraProjectName) {
      setSpaceName(jiraProjectName);
    }
  }, [
    open,
    isJira,
    integrationType,
    selectedJiraProject,
    jiraProjects,
    activeSource?.label,
    spaceName,
  ]);

  const parseCsvData = React.useCallback(
    (text: string) => {
      const parsed = parseCsvText(text || '', delimiter.trim() || undefined);
      const fields = parsed.fields.map(field => String(field).trim()).filter(Boolean);
      const rows = Array.isArray(parsed.rows) ? (parsed.rows as Record<string, any>[]) : [];
      setCsvText(text || '');
      setCsvColumns(fields);
      setFieldMappings({});
      setIncludeInImport(Object.fromEntries(fields.map((f: string) => [f, true])));
      setCsvRows(rows);
      setUserEmails({});
      return {
        columnsCount: fields.length,
        rowsCount: rows.length,
      };
    },
    [delimiter]
  );
  const worklenzFieldOptions = React.useMemo(
    () => [
      {
        value: 'key',
        label: tt('fields.taskTitle', 'Task name / Title'),
      },
      { value: 'description', label: tt('fields.description', 'Description') },
      { value: 'progress', label: tt('fields.progress', 'Progress') },
      { value: 'status', label: tt('fields.status', 'Status') },
      { value: 'assignees', label: tt('fields.assignees', 'Assignees') },
      { value: 'labels', label: tt('fields.labels', 'Labels') },
      { value: 'phase', label: tt('fields.phase', 'Phase') },
      { value: 'priority', label: tt('fields.priority', 'Priority') },
      { value: 'timeTracking', label: tt('fields.timeTracking', 'Time Tracking') },
      { value: 'estimation', label: tt('fields.estimation', 'Estimation') },
      { value: 'startDate', label: tt('fields.startDate', 'Start Date') },
      { value: 'dueDate', label: tt('fields.dueDate', 'Due Date') },
      { value: 'dueTime', label: tt('fields.dueTime', 'Due Time') },
      { value: 'completedDate', label: tt('fields.completedDate', 'Completed Date') },
      { value: 'createdDate', label: tt('fields.createdDate', 'Created Date') },
      { value: 'lastUpdated', label: tt('fields.lastUpdated', 'Last Updated') },
      { value: 'reporter', label: tt('fields.reporter', 'Reporter') },
    ],
    [tt]
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

  const {
    statusColumnKey,
    statusValues,
    statusOptions,
    csvUserRows,
    mappedFieldCount,
    modalDims,
    hierarchyCount,
    hierarchyDisplayRows,
  } = useImportDerivedData({
    fieldMappings,
    csvRows,
    csvColumns,
    worklenzStatuses,
    defaultWorkTypes,
    t,
    fieldMappingRows,
    integrationType: integrationType as 'direct' | 'csv',
    hierarchyRows,
  });

  const autoMappedRef = React.useRef(false);

  const persistImportOptions = React.useCallback(
    async (jobId: string, overrides?: { importMembers?: boolean; importAttachments?: boolean }) => {
      await updateImportSource(jobId, {
        importMembers:
          typeof overrides?.importMembers === 'boolean' ? overrides.importMembers : importMembers,
        importAttachments:
          typeof overrides?.importAttachments === 'boolean'
            ? overrides.importAttachments
            : importAttachments,
      });
    },
    [importAttachments, importMembers]
  );

  const runAutoMapping = React.useCallback(
    async (suppressToast?: boolean) => {
      if (!job?.id) return;
      try {
        setAutoMappingRunning(true);
        const fieldsResp = await autoImportFields(job.id);
        if (Array.isArray(fieldsResp)) {
          const recommendedTargets = new Set([
            'key',
            'description',
            'status',
            'assignees',
            'labels',
            'priority',
            'progress',
            'startDate',
            'dueDate',
          ]);

          setFieldMappingRows(
            (fieldsResp as Array<{
              source_field: string;
              target_field: string;
              required?: boolean;
              include?: boolean;
            }>).map(row => ({
              ...row,
              // Default: include only "recommended" Worklenz fields (and any required fields).
              // If backend explicitly sends include, respect it.
              include:
                typeof row.include === 'boolean'
                  ? row.include
                  : !!row.required || recommendedTargets.has(row.target_field),
            }))
          );
        }
        const hierarchyResp = await autoImportHierarchy(job.id);
        if (Array.isArray(hierarchyResp)) setHierarchyRows(hierarchyResp as any);
        autoMappedRef.current = true;
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
    if (!csvText.trim()) return;
    parseCsvData(csvText);
  }, [delimiter, parseCsvData]); // re-parse when delimiter changes

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
  const hasTaskTitleMapping = React.useMemo(() => {
    const aliases = new Set([
      'key',
      'title',
      'name',
      'task',
      'taskname',
      'tasktitle',
      'summary',
    ]);

    return Object.entries(fieldMappings).some(([sourceColumn, targetField]) => {
      if (!targetField) return false;
      if (includeInImport[sourceColumn] === false) return false;
      const normalized = targetField.toLowerCase().replace(/[^a-z0-9]/g, '');
      return aliases.has(normalized);
    });
  }, [fieldMappings, includeInImport]);

  const { ensureImportJob, ensureDefaultProjectStatusId, persistAsanaSelection } =
    useImportJobHelpers({
      integrationType: integrationType as 'direct' | 'csv',
      providerForApi,
      job,
      setJob,
      defaultProjectStatusId,
      setDefaultProjectStatusId,
      worklenzStatuses,
      setWorklenzStatuses,
      defaultWorkTypes,
      t,
    });

  const handleBack = () => setStep(s => Math.max(0, s - 1));
  const handleNext = () => {
    if (integrationType === 'csv' && step === 2 && !hasTaskTitleMapping) {
      message.error(
        t('importStep.taskTitleRequired', {
          defaultValue:
            'Task name / Title mapping is required. Map at least one CSV column to Task name / Title.',
        })
      );
      return;
    }
    setStep(s => Math.min(totalSteps - 1, s + 1));
  };
  const handleModalClose = () => {
    setStep(0);
    onClose();
  };
  const handleFinish = useImportFinishHandler({
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
  });

  const handleStartNewImport = () => {
    setShowCompletion(false);
    handleModalClose();
  };

  const {
    handleAsanaAuth,
    handleMondayValidate,
    handleTrelloValidate,
    handleClickupValidate,
    handleJiraValidate,
  } = useImportAuthHandlers({
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
  });

  const handleSourcePick = (selected: { key: string; label: string; icon: React.ReactNode }) => {
    setSelectedSource(selected);
    setStep(0);
    setShowCompletion(false);
  };

  const showIllustration = !!activeSource && !(integrationType === 'direct' && step === 2);
  const normalizedSourceIcon = React.useMemo(() => {
    if (!activeSource?.icon || !React.isValidElement(activeSource.icon)) return activeSource?.icon;

    const isImageTag = typeof activeSource.icon.type === 'string' && activeSource.icon.type === 'img';
    if (!isImageTag) return activeSource.icon;

    const currentStyle = (activeSource.icon.props as { style?: React.CSSProperties })?.style || {};
    return React.cloneElement(activeSource.icon as React.ReactElement<any>, {
      style: {
        ...currentStyle,
        width: 40,
        height: 40,
        maxWidth: 40,
        maxHeight: 40,
        objectFit: 'contain',
      },
    });
  }, [activeSource?.icon]);
  const modalTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {showIllustration && activeSource?.icon && (
        <div
          style={{
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            fontSize: 36,
            overflow: 'hidden',
            flex: '0 0 40px',
          }}
        >
          {normalizedSourceIcon}
        </div>
      )}
      <Typography.Title level={3} style={{ margin: 0, fontSize: 26 }}>
        {activeSource?.label || t('importHeader', { defaultValue: 'Create a project by importing tasks' })}
      </Typography.Title>
    </div>
  );

  if (!activeSource) {
    return (
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={900}
        destroyOnHidden
        title={modalTitle}
        styles={{
          header: {
            paddingBottom: 8,
          },
          body: {
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <div className="import-export-settings import-export-modal-content-wrapper">
          <Typography.Title level={4} className="section-title">
            {t('importFrom', { defaultValue: 'Choose your source' })}
          </Typography.Title>

          <div className="import-source-grid">
            {AVAILABLE_IMPORT_SOURCES.filter(sourceOption => sourceOption.key !== 'csv')
              .sort((a, b) => a.order - b.order)
              .map(sourceOption => (
                <div
                  className={`import-source-card${sourceOption.comingSoon ? ' import-source-card--coming-soon' : ''}`}
                  key={sourceOption.key}
                  role={sourceOption.comingSoon ? undefined : 'button'}
                  tabIndex={sourceOption.comingSoon ? -1 : 0}
                  onClick={sourceOption.comingSoon ? undefined : () => handleSourcePick(sourceOption)}
                  onKeyDown={sourceOption.comingSoon ? undefined : e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSourcePick(sourceOption);
                    }
                  }}
                >
                  <div className="import-source-content">
                    <div className="import-source-icon">{sourceOption.icon}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="import-source-label">{sourceOption.label}</span>
                      {sourceOption.comingSoon && (
                        <span className="import-source-coming-soon-badge">Coming soon</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <div className="cant-find-app-section mt-10">
            <Card className="cant-find-app-card" bordered={false}>
              <Typography.Title level={5} className="mb-1">
                {t('cantFindAppTitle', { defaultValue: "Can't find your app?" })}
              </Typography.Title>
              <Typography.Text type="secondary" className="mb-4 d-block">
                {t('cantFindAppDesc', {
                  defaultValue:
                    "If you don't see your app here, select CSV to use any CSV file to import your data.",
                })}
              </Typography.Text>
              <div
                className="csv-dropzone"
                role="button"
                tabIndex={0}
                onClick={() => {
                  const csvSource = AVAILABLE_IMPORT_SOURCES.find(item => item.key === 'csv');
                  if (csvSource) handleSourcePick(csvSource);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const csvSource = AVAILABLE_IMPORT_SOURCES.find(item => item.key === 'csv');
                    if (csvSource) handleSourcePick(csvSource);
                  }
                }}
              >
                <div className="csv-dropzone-icon">
                  <img src="/file-types/csv.png" alt="CSV file" />
                </div>
                <Typography.Text className="csv-dropzone-title">
                  {t('selectCsv', { defaultValue: 'Select a CSV file to import' })}
                </Typography.Text>
                <Typography.Text type="secondary" className="csv-dropzone-helper">
                  {t('dragCsv', { defaultValue: 'or Drag and Drop here' })}
                </Typography.Text>
              </div>
            </Card>
          </div>
        </div>
      </Modal>
    );
  }

  const renderAuthGate = () => (
    <AuthGateContent
      lowerKey={lowerKey}
      isJira={isJira}
      t={t}
      themeToken={themeToken}
      authError={authError}
      authLoading={authLoading}
      onClose={onClose}
      handleAsanaAuth={handleAsanaAuth}
      mondayToken={mondayToken}
      setMondayToken={setMondayToken}
      handleMondayValidate={handleMondayValidate}
      trelloKey={trelloKey}
      setTrelloKey={setTrelloKey}
      trelloToken={trelloToken}
      setTrelloToken={setTrelloToken}
      handleTrelloValidate={handleTrelloValidate}
      clickupToken={clickupToken}
      setClickupToken={setClickupToken}
      selectedClickupSpace={selectedClickupSpace}
      setSelectedClickupSpace={setSelectedClickupSpace}
      selectedClickupList={selectedClickupList}
      setSelectedClickupList={setSelectedClickupList}
      clickupTeams={clickupTeams}
      handleClickupValidate={handleClickupValidate}
      jiraEmail={jiraEmail}
      setJiraEmail={setJiraEmail}
      jiraDomain={jiraDomain}
      setJiraDomain={setJiraDomain}
      jiraToken={jiraToken}
      setJiraToken={setJiraToken}
      handleJiraValidate={handleJiraValidate}
    />
  );

  const renderCompletionContent = () => (
    <ImportCompletionContent t={t} handleStartNewImport={handleStartNewImport} />
  );

  return (
    <Modal
      centered
      open={open}
      onCancel={onClose}
      title={modalTitle}
      footer={null}
      width={modalDims.width}
      style={{
        top: 40,
      }}
      styles={{
        content: {
          overflow: 'hidden',
        },
        header: {
          background: themeToken.colorBgElevated,
        },
        body: {
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          background: themeToken.colorBgElevated,
          overflow: 'hidden',
        },
      }}
    >
      <div
        className="import-modal-body"
        style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}
      >
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
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}
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
            <div className="content-body" style={{ padding: 0 }}>
              {renderAuthGate()}
            </div>
          ) : (
            <>
              <div
                className="content-body"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: integrationType === 'csv' ? 'auto' : 'visible',
                  overflowX: 'hidden',
                  maxHeight: integrationType === 'csv' ? 'calc(100vh - 340px)' : undefined,
                  paddingRight: integrationType === 'csv' ? 4 : 0,
                }}
              >
                <ImportStepContent
                  integrationType={integrationType as 'direct' | 'csv'}
                  step={step}
                  lowerKey={lowerKey}
                  isJira={isJira}
                  authCompleted={authCompleted}
                  t={t}
                  themeToken={themeToken}
                  sourceLabel={activeSource?.label || t('importStep.yourApp', { defaultValue: 'your app' })}
                  source={activeSource}
                  asanaWorkspaces={asanaWorkspaces}
                  clickupTeams={clickupTeams}
                  jiraProjects={jiraProjects}
                  asanaProjects={asanaProjects}
                  selectedWorkspace={selectedWorkspace}
                  setSelectedWorkspace={setSelectedWorkspace}
                  setSelectedProject={setSelectedProject}
                  jiraDomain={jiraDomain}
                  selectedBoard={selectedBoard}
                  setSelectedBoard={setSelectedBoard}
                  selectedTrelloBoard={selectedTrelloBoard}
                  setSelectedTrelloBoard={setSelectedTrelloBoard}
                  trelloBoards={trelloBoards}
                  mondayBoards={mondayBoards}
                  job={job}
                  runAutoMapping={runAutoMapping}
                  selectedClickupList={selectedClickupList}
                  setSelectedClickupList={setSelectedClickupList}
                  selectedClickupSpace={selectedClickupSpace}
                  selectedJiraProject={selectedJiraProject}
                  setSelectedJiraProject={setSelectedJiraProject}
                  persistAsanaSelection={persistAsanaSelection}
                  selectedProject={selectedProject}
                  spaceName={spaceName}
                  setSpaceName={setSpaceName}
                  reviewSubScreen={reviewSubScreen}
                  setReviewSubScreen={setReviewSubScreen}
                  hierarchyCount={hierarchyCount}
                  mappedFieldCount={mappedFieldCount}
                  fieldMappingRows={fieldMappingRows}
                  importMembers={importMembers}
                  setImportMembers={setImportMembers}
                  importAttachments={importAttachments}
                  setImportAttachments={setImportAttachments}
                  hierarchyDisplayRows={hierarchyDisplayRows}
                  setHierarchyRows={setHierarchyRows}
                  worklenzFieldOptions={worklenzFieldOptions}
                  setFieldMappingRows={setFieldMappingRows}
                  uploadedCsvFileRef={uploadedCsvFileRef}
                  parseCsvData={parseCsvData}
                  encoding={encoding}
                  setEncoding={setEncoding}
                  delimiter={delimiter}
                  setDelimiter={setDelimiter}
                  csvSettingsOpen={csvSettingsOpen}
                  setCsvSettingsOpen={setCsvSettingsOpen}
                  csvColumns={csvColumns}
                  fieldMappings={fieldMappings}
                  setFieldMappings={setFieldMappings}
                  includeInImport={includeInImport}
                  setIncludeInImport={setIncludeInImport}
                  statusValues={statusValues}
                  searchValue={searchValue}
                  setSearchValue={setSearchValue}
                  filter={filter}
                  setFilter={setFilter}
                  statusColumnKey={statusColumnKey}
                  statusOptions={statusOptions}
                  statusValueMapping={statusValueMapping}
                  setStatusValueMapping={setStatusValueMapping}
                  csvUserRows={csvUserRows}
                  userEmails={userEmails}
                  setUserEmails={setUserEmails}
                  addUsers={addUsers}
                  setAddUsers={setAddUsers}
                  csvRows={csvRows}
                />
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
                    (integrationType === 'csv' && step === 2 && !hasTaskTitleMapping) ||
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
