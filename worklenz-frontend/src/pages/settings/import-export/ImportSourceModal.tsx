import React from 'react';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  Modal,
  Button,
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
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import {
  stepSet,
  csvTextSet,
  csvColumnsSet,
  csvRowsSet,
  fieldMappingsSet,
  includeInImportSet,
  statusValueMappingSet,
  pendingNewStatusesSet,
  addUsersSet,
  userEmailsSet,
  spaceNameSet,
  spaceTypeSet,
  spaceTemplateSet,
  delimiterSet,
  encodingSet,
  stepErrorSet,
  importWizardReset,
} from '@/features/imports/importWizardSlice';
import { AuthGateContent } from './import-source-modal/components/AuthGateContent';
import { ChooseImportSourceContent } from './import-source-modal/components/ChooseImportSourceContent';
import { ImportCompletionContent } from './import-source-modal/components/ImportCompletionContent';
import { ImportStepContent } from './import-source-modal/components/ImportStepContent';
import {
  AUTH_GATE_APPS,
  DIRECT_INTEGRATION_APPS,
  isJiraProvider,
} from './import-source-modal/constants';
import { useImportAuthHandlers } from './import-source-modal/hooks/useImportAuthHandlers';
import { useImportDerivedData } from './import-source-modal/hooks/useImportDerivedData';
import { useImportFinishHandler } from './import-source-modal/hooks/useImportFinishHandler';
import { useImportJobHelpers } from './import-source-modal/hooks/useImportJobHelpers';
import { ClickupTeam, ImportSourceModalProps } from './import-source-modal/types';
import { autoMapCsvColumns, parseCsvText } from './import-source-modal/utils';
import './import-export-settings.css';

export const ImportSourceModal: React.FC<ImportSourceModalProps> = ({
  open,
  onClose,
  source,
  createTargetProject,
  initialProjectName,
  hideProjectSetup = false,
  onImportStarted,
}) => {
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
    if (!open || !activeSource) return;

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
    dispatch(
      importWizardReset({
        spaceName: initialProjectName || (activeSource.label ? `${activeSource.label} import` : ''),
      })
    );
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
  }, [open, activeSource, authNeeded, initialProjectName, integrationType, providerForApi]);

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
          tt('steps.previewCsv', 'Preview'),
          ...(hideProjectSetup ? [] : [tt('steps.setupProject', 'Set up project')]),
          tt('steps.mapFields', 'Map fields'),
          tt('steps.mapValues', 'Map statuses'),
          tt('steps.moveUsers', 'Move users'),
          tt('steps.reviewDetails', 'Review details'),
        ];

  const dispatch = useAppDispatch();
  const statusCategories = useAppSelector(state => state.taskStatusReducer.statusCategories);

  // --- Wizard state owned by importWizardSlice (single source of truth; see
  // src/features/imports/importWizardSlice.ts). Read via selectors and written
  // through setState-shaped shims (makeWizardSetter below) so the rest of this
  // component and every step component keeps its existing [value, setValue] API. ---
  const wizard = useAppSelector(state => state.importWizardReducer);
  const {
    step,
    furthestCompletedStep,
    csvText,
    csvColumns,
    csvRows,
    fieldMappings,
    includeInImport,
    statusValueMapping,
    pendingNewStatuses,
    addUsers,
    userEmails,
    spaceName,
    spaceType,
    spaceTemplate,
    delimiter,
    encoding,
  } = wizard;

  function makeWizardSetter<T>(
    current: T,
    actionCreator: (value: T) => { type: string; payload: T }
  ): React.Dispatch<React.SetStateAction<T>> {
    return updater => {
      const next =
        typeof updater === 'function' ? (updater as (prev: T) => T)(current) : updater;
      dispatch(actionCreator(next));
    };
  }

  const setStep = makeWizardSetter(step, stepSet);
  const setCsvText = makeWizardSetter(csvText, csvTextSet);
  const setCsvColumns = makeWizardSetter(csvColumns, csvColumnsSet);
  const setCsvRows = makeWizardSetter(csvRows, csvRowsSet);
  const setFieldMappings = makeWizardSetter(fieldMappings, fieldMappingsSet);
  const setIncludeInImport = makeWizardSetter(includeInImport, includeInImportSet);
  const setStatusValueMapping = makeWizardSetter(statusValueMapping, statusValueMappingSet);
  const setPendingNewStatuses = makeWizardSetter(pendingNewStatuses, pendingNewStatusesSet);
  const setAddUsers = makeWizardSetter(addUsers, addUsersSet);
  const setUserEmails = makeWizardSetter(userEmails, userEmailsSet);
  const setSpaceName = makeWizardSetter(spaceName, spaceNameSet);
  const setSpaceType = makeWizardSetter(spaceType, spaceTypeSet);
  const setSpaceTemplate = makeWizardSetter(spaceTemplate, spaceTemplateSet);
  const setDelimiter = makeWizardSetter(delimiter, delimiterSet);
  const setEncoding = makeWizardSetter(encoding, encodingSet);

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

  const uploadedCsvFileRef = React.useRef<File | null>(null);

  // Search/filter for mapping step
  const [searchValue, setSearchValue] = React.useState<string>('');
  const [filter, setFilter] = React.useState<string>('all');

  // Importing state
  const [isImporting, setIsImporting] = React.useState<boolean>(false);
  const [autoMappingRunning, setAutoMappingRunning] = React.useState(false);
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
      setFieldMappings(autoMapCsvColumns(fields));
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
            (
              fieldsResp as Array<{
                source_field: string;
                target_field: string;
                required?: boolean;
                include?: boolean;
              }>
            ).map(row => ({
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

  // Categories a newly-created status must belong to (To Do / Doing / Done) — needed
  // when the user chooses to create a new status during CSV status mapping. Reuses
  // the shared taskStatusReducer slice (same data the task-board "add status" UI
  // fetches) instead of a component-local request, so it's cached across the app.
  React.useEffect(() => {
    if (!statusCategories.length) dispatch(fetchStatusesCategories());
  }, [dispatch, statusCategories.length]);

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
  const projectSetupStep = hideProjectSetup ? 0 : 2;
  const csvMappingStep = hideProjectSetup ? 2 : 3;

  // Clear a project-name-conflict error (set in useImportFinishHandler's catch
  // block) as soon as the user edits the name — the next Finish attempt will
  // re-validate against the server anyway.
  const spaceNameErrorClearedRef = React.useRef(spaceName);
  React.useEffect(() => {
    if (spaceNameErrorClearedRef.current === spaceName) return;
    spaceNameErrorClearedRef.current = spaceName;
    if (wizard.stepErrors[projectSetupStep]) {
      dispatch(stepErrorSet({ step: projectSetupStep, error: null }));
    }
  }, [spaceName, projectSetupStep, wizard.stepErrors, dispatch]);
  const hasTaskTitleMapping = React.useMemo(() => {
    const aliases = new Set(['key', 'title', 'name', 'task', 'taskname', 'tasktitle', 'summary']);

    return Object.entries(fieldMappings).some(([sourceColumn, targetField]) => {
      if (!targetField) return false;
      if (includeInImport[sourceColumn] === false) return false;
      const normalized = targetField.toLowerCase().replace(/[^a-z0-9]/g, '');
      return aliases.has(normalized);
    });
  }, [fieldMappings, includeInImport]);

  // Live per-step validation surfaced on the Steps bar itself, not just on a blocked
  // Next click — but only once a step has actually been reached, so we don't flag
  // steps the user hasn't gotten to yet.
  React.useEffect(() => {
    if (integrationType !== 'csv' || step < csvMappingStep) return;
    dispatch(
      stepErrorSet({
        step: csvMappingStep,
        error: hasTaskTitleMapping
          ? null
          : t('importStep.taskTitleRequired', {
              defaultValue:
                'Task name / Title mapping is required. Map at least one CSV column to Task name / Title.',
            }),
      })
    );
  }, [integrationType, step, csvMappingStep, hasTaskTitleMapping, dispatch, t]);

  React.useEffect(() => {
    if (integrationType !== 'csv' || step < totalSteps - 1) return;
    const invalid = !csvText.trim() || !spaceName.trim();
    dispatch(
      stepErrorSet({
        step: totalSteps - 1,
        error: invalid
          ? t('importStep.reviewStepIncomplete', {
              defaultValue: 'Upload a CSV file and enter a project name to finish.',
            })
          : null,
      })
    );
  }, [integrationType, step, totalSteps, csvText, spaceName, dispatch, t]);

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
    if (integrationType === 'csv' && step === csvMappingStep && !hasTaskTitleMapping) {
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
    setStep,
    projectSetupStep,
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
    pendingNewStatuses,
    csvUserRows,
    userEmails,
    ensureImportJob,
    ensureDefaultProjectStatusId,
    persistImportOptions,
    createTargetProject,
    onImportStarted,
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

    const isImageTag =
      typeof activeSource.icon.type === 'string' && activeSource.icon.type === 'img';
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
        {activeSource?.label ||
          t('importHeader', { defaultValue: 'Create a project by importing tasks' })}
      </Typography.Title>
    </div>
  );

  if (!activeSource) {
    return (
      <ChooseImportSourceContent
        open={open}
        onClose={onClose}
        t={t}
        modalTitle={modalTitle}
        onSourcePick={handleSourcePick}
      />
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
                items={steps.map((title, index) => ({
                  title,
                  status: wizard.stepErrors[index] ? 'error' : undefined,
                }))}
                onChange={current => {
                  if (navigationDisabled) return;
                  // Only allow jumping to a step already reached — never skip ahead of
                  // unfinished steps (matches standard wizard UX: back anytime, forward
                  // only by completing the step in between).
                  if (current > furthestCompletedStep) return;
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
                  sourceLabel={
                    activeSource?.label || t('importStep.yourApp', { defaultValue: 'your app' })
                  }
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
                  pendingNewStatuses={pendingNewStatuses}
                  setPendingNewStatuses={setPendingNewStatuses}
                  statusCategories={statusCategories}
                  csvUserRows={csvUserRows}
                  userEmails={userEmails}
                  setUserEmails={setUserEmails}
                  addUsers={addUsers}
                  setAddUsers={setAddUsers}
                  csvRows={csvRows}
                  hideProjectSetup={hideProjectSetup}
                  onCsvUploaded={() => setStep(s => (s === 0 ? Math.min(totalSteps - 1, s + 1) : s))}
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
                    (integrationType === 'csv' &&
                      step === csvMappingStep &&
                      !hasTaskTitleMapping) ||
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
