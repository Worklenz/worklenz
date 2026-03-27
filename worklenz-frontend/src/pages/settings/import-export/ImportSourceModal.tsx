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

export const ImportSourceModal: React.FC<ImportSourceModalProps> = ({ open, onClose, source }) => {
  // Prevent ReferenceError by checking for source before any usage
  if (!source) return null;

  const { t } = useTranslation('settings/import-export');
  const { token: themeToken } = theme.useToken();
  const tt = React.useCallback(
    (key: string, defaultValue: string, options?: Record<string, unknown>) =>
      t(key, { defaultValue, ...(options || {}) }),
    [t]
  );

  // --- Dynamic import flow state ---
  const lowerKey = source.key.toLowerCase();
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
    setStep(0);
    setReviewSubScreen('main');
    setShowAdvancedSpaceOptions(false);
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
      ? [
        tt('steps.selectList', 'Select list'),
        tt('steps.createSpace', 'Create space'),
        tt('steps.reviewImport', 'Review Details & Import'),
      ]
      : [
        tt('steps.uploadCsv', 'Upload CSV'),
        tt('steps.setupSpace', 'Set up space'),
        tt('steps.mapFields', 'Map fields'),
        tt('steps.mapValues', 'Map values'),
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
  const [showAdvancedSpaceOptions, setShowAdvancedSpaceOptions] = React.useState(false);

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
  const uploadedCsvFileRef = React.useRef<File | null>(null);
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

  const parseCsvData = React.useCallback(
    (text: string) => {
      const parsed = parseCsvText(text || '', delimiter.trim() || undefined);
      const fields = parsed.fields.map(field => String(field).trim()).filter(Boolean);
      setCsvText(text || '');
      setCsvColumns(fields);
      setFieldMappings({});
      setIncludeInImport(Object.fromEntries(fields.map((f: string) => [f, true])));
      setCsvRows(Array.isArray(parsed.rows) ? (parsed.rows as Record<string, any>[]) : []);
      setUserEmails({});
    },
    [delimiter]
  );
  const worklenzFieldOptions = React.useMemo(
    () => [
      { value: 'key', label: tt('fields.key', 'Key') },
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
    workTypeOptions,
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
  const handleNext = () => setStep(s => Math.min(totalSteps - 1, s + 1));
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
    workTypeMapping,
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

  const showIllustration = !(integrationType === 'direct' && step === 2);
  const normalizedSourceIcon = React.useMemo(() => {
    if (!source?.icon || !React.isValidElement(source.icon)) return source?.icon;

    const isImageTag = typeof source.icon.type === 'string' && source.icon.type === 'img';
    if (!isImageTag) return source.icon;

    const currentStyle = (source.icon.props as { style?: React.CSSProperties })?.style || {};
    return React.cloneElement(source.icon as React.ReactElement<any>, {
      style: {
        ...currentStyle,
        width: 40,
        height: 40,
        maxWidth: 40,
        maxHeight: 40,
        objectFit: 'contain',
      },
    });
  }, [source?.icon]);
  const modalTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {showIllustration && source?.icon && (
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
        {source.label}
      </Typography.Title>
    </div>
  );

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
          overflowY: 'auto',
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
              <div className="content-body" style={{ flex: 1 }}>
                <ImportStepContent
                  integrationType={integrationType as 'direct' | 'csv'}
                  step={step}
                  lowerKey={lowerKey}
                  isJira={isJira}
                  authCompleted={authCompleted}
                  t={t}
                  themeToken={themeToken}
                  sourceLabel={source?.label || 'your app'}
                  source={source}
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
                  spaceType={spaceType}
                  setSpaceType={setSpaceType}
                  spaceName={spaceName}
                  setSpaceName={setSpaceName}
                  showAdvancedSpaceOptions={showAdvancedSpaceOptions}
                  setShowAdvancedSpaceOptions={setShowAdvancedSpaceOptions}
                  spaceTemplate={spaceTemplate}
                  setSpaceTemplate={setSpaceTemplate}
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
                  configOpen={configOpen}
                  setConfigOpen={setConfigOpen}
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
                  workTypeOptions={workTypeOptions}
                  workTypeMapping={workTypeMapping}
                  setWorkTypeMapping={setWorkTypeMapping}
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
