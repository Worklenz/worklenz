import React from 'react';
import {
  Modal,
  Button,
  Typography,
  Upload,
  Steps,
  Collapse,
  Select,
  Input,
  Tooltip,
  Card,
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
} from '@ant-design/icons';
import Papa from 'papaparse';
import { useTranslation } from 'react-i18next';
import {
  clickupWorkspaces,
  createImportJob,
  getImportJob,
  mondayValidate,
  startAsanaAuth,
} from '@/api/imports';
import type { ImportJob } from '@/api/imports';

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
  const directIntegrationApps = ['asana', 'monday', 'clickup', 'trello'];
  const authGateApps = ['asana', 'monday', 'clickup'];
  const lowerKey = source.key.toLowerCase();
  const integrationType = directIntegrationApps.includes(lowerKey) ? 'direct' : 'csv';
  const authNeeded = authGateApps.includes(lowerKey);

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

  React.useEffect(() => {
    setStep(0);
    setReviewSubScreen('main');
    setAuthCompleted(!authNeeded);
    setMondayToken('');
    setSelectedWorkspace('');
    setSelectedProject('');
    setSelectedBoard('');
    setSelectedClickupSpace('');
    setSelectedClickupList('');
    setAsanaProjects([]);
    setAsanaWorkspaces([]);
    setMondayBoards([]);
    setClickupTeams([]);
    setClickupToken('');
    setAuthError(null);
    setShowCompletion(false);

    let cancelled = false;
    const initJob = async () => {
      try {
        const created = await createImportJob({
          provider: lowerKey,
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
      ? ['Select list', 'Create space', 'Review details', 'Import data']
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

  // Example field mapping data (should be dynamic in real app)
  const fieldMappingRows = [
    { asana: 'Task name', jira: 'Summary', required: true, include: true },
    { asana: 'Assignee', jira: 'Assignee', required: false, include: true },
    { asana: 'Created by', jira: 'Reporter', required: false, include: true },
    { asana: 'Description', jira: 'Description', required: false, include: true },
    { asana: 'Due on', jira: 'Due date', required: false, include: true },
    { asana: 'Start date', jira: 'Start date', required: false, include: true },
    { asana: 'Collaborators', jira: 'Watchers', required: false, include: true },
  ];
  // Example hierarchy mapping
  const hierarchyRows = [
    { asana: 'Section', jira: 'Status' },
    { asana: 'Task', jira: 'Task' },
    { asana: 'Subtask', jira: 'Subtask' },
    { asana: 'Nested subtask', jira: 'Subtask' },
  ];
  const [csvSettingsOpen, setCsvSettingsOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [encoding, setEncoding] = React.useState('UTF-8');

  // State for CSV columns and mapping
  const [csvColumns, setCsvColumns] = React.useState<string[]>([]);
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

  const navigationDisabled = authNeeded && !authCompleted;

  const handleBack = () => setStep(s => Math.max(0, s - 1));
  const handleNext = () => setStep(s => Math.min(totalSteps - 1, s + 1));
  const handleModalClose = () => {
    setStep(0);
    onClose();
  };
  const handleFinish = () => setShowCompletion(true);
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
      const popup = window.open(authUrl, 'asana-auth');
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
            if (auth.projects?.[0]?.id) setSelectedProject(auth.projects[0].id);
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
    if (!job || !mondayToken.trim()) return;
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
  // Example content for each step
  function renderStepContent() {
    if (integrationType === 'direct') {
      // 4-step direct integration flow
      if (step === 0) {
        // Step 1: Select project/list/board
        const workspaceOptions =
          lowerKey === 'asana'
            ? asanaWorkspaces.map(ws => ({ value: ws.id, label: ws.name }))
            : lowerKey === 'clickup'
              ? clickupTeams.flatMap(team =>
                  team.spaces.map(space => ({
                    value: space.id,
                    label: `${team.name} • ${space.name}`,
                  }))
                )
              : [];
        const projectOptions =
          lowerKey === 'asana'
            ? asanaProjects
                .filter(p => !selectedWorkspace || p.workspaceId === selectedWorkspace)
                .map(p => ({ value: p.id, label: p.name }))
            : [];
        const boardOptions =
          lowerKey === 'monday' ? mondayBoards.map(b => ({ value: b.id, label: b.name })) : [];

        return (
          <div>
            <Typography.Title level={3}>
              {t('importStep.selectList', 'Select a source')}
            </Typography.Title>
            <Typography.Paragraph>
              {t(
                'importStep.selectListHelp',
                'Select the workspace and list/board you’d like to import data from. Required fields are marked with an asterisk.'
              )}
            </Typography.Paragraph>
            <div style={{ display: 'flex', gap: 48 }}>
              <div style={{ flex: 1, maxWidth: 400 }}>
                {lowerKey !== 'monday' && (
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

                <label>
                  {lowerKey === 'monday'
                    ? t('importStep.boardLabel', 'Board *')
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
                ) : (
                  <Select
                    style={{ width: '100%' }}
                    placeholder={t('importStep.projectPlaceholder', 'Select a project')}
                    value={selectedProject || undefined}
                    onChange={v => setSelectedProject(v)}
                    options={projectOptions}
                    disabled={!authCompleted}
                  />
                )}
              </div>
              <div
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {/* Illustration placeholder */}
                <div style={{ width: 240, height: 140, background: '#23272f', borderRadius: 12 }} />
              </div>
            </div>
          </div>
        );
      }
      if (step === 1) {
        // Step 2: Create space
        return (
          <div style={{ display: 'flex', gap: 48 }}>
            <div style={{ flex: 1, maxWidth: 400 }}>
              <Typography.Title level={3}>{'Set up a space in Worklenz'}</Typography.Title>
              <Typography.Paragraph>
                {
                  'Your team’s data from Asana will be imported into this space. Check if you’re selecting the right Worklenz space, template, and space type as these options can’t be modified later. All fields are required.'
                }
              </Typography.Paragraph>
              <label>{'Jira space'}</label>
              <Select
                style={{ width: '100%', marginBottom: 16 }}
                value="business"
                options={[
                  { value: 'business', label: 'Business space' },
                  { value: 'software', label: 'Software space' },
                ]}
              />
              <label>{'Space name'}</label>
              <Input style={{ width: '100%', marginBottom: 8 }} value="worklenzse" />
              <a href="#" style={{ color: '#4096ff', fontSize: 14 }}>
                {'Show more'}
              </a>
            </div>
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {/* Board illustration placeholder */}
              <div style={{ width: 320, height: 180, background: '#18181a', borderRadius: 16 }} />
            </div>
          </div>
        );
      }
      if (step === 2) {
        // Step 3: Review details (main or sub-screens)
        if (reviewSubScreen === 'main') {
          const reviewCards = [
            {
              key: 'hierarchy',
              title: 'Space hierarchy',
              description: 'Sections from Asana are mapped to Status',
              iconBg: '#1f6feb',
              icon: '📦',
              action: () => setReviewSubScreen('hierarchy'),
              control: <RightOutlined style={{ color: '#9ca3af', fontSize: 16 }} />,
            },
            {
              key: 'fieldMapping',
              title: 'Field mapping',
              description: '9/9 imported fields are automatically mapped',
              iconBg: '#6e56cf',
              icon: '📑',
              action: () => setReviewSubScreen('fieldMapping'),
              control: <RightOutlined style={{ color: '#9ca3af', fontSize: 16 }} />,
            },
            {
              key: 'importMembers',
              title: 'Import all members from Asana project',
              description: 'Brings collaborators into the Jira space',
              iconBg: '#0f9d58',
              icon: '🧑‍🤝‍🧑',
              action: undefined,
              control: <Switch checked={importMembers} onChange={setImportMembers} />,
            },
            {
              key: 'importAttachments',
              title: 'Import all attachments',
              description: 'Pulls files and images from tasks',
              iconBg: '#f59e0b',
              icon: '📎',
              action: undefined,
              control: <Switch checked={importAttachments} onChange={setImportAttachments} />,
            },
          ];

          return (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 720 }}>
                <Typography.Title level={3} style={{ marginBottom: 4 }}>
                  {'Review details'}
                </Typography.Title>
                <Typography.Paragraph style={{ marginBottom: 24 }}>
                  {
                    'We’ve mapped your project and you’re ready to import. Here’s how the Asana data will be imported into the Jira project. Learn more about the project setup'
                  }
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
                        background: '#111318',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
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
                          <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 16 }}>
                            {card.title}
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: 13 }}>{card.description}</div>
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
              <div style={{ width: '100%', maxWidth: 900 }}>
                <a
                  href="#"
                  style={{ color: '#7aa2f7', display: 'inline-flex', alignItems: 'center' }}
                  onClick={e => {
                    e.preventDefault();
                    setReviewSubScreen('main');
                  }}
                >
                  <RightOutlined
                    style={{ fontSize: 12, marginRight: 6, transform: 'rotate(180deg)' }}
                  />
                  {'Back to review details'}
                </a>
                <Typography.Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>
                  {'Space hierarchy'}
                </Typography.Title>
                <Typography.Paragraph style={{ marginBottom: 20 }}>
                  {
                    "Here’s how we've mapped your Asana data to Worklenz. More about project hierarchy in Worklenz"
                  }
                </Typography.Paragraph>

                <div
                  style={{
                    background: '#0e1116',
                    borderRadius: 12,
                    padding: 16,
                    border: '1px solid #1e2633',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <span style={{ color: '#ea4335', fontSize: 16, fontWeight: 600 }}>Asana</span>
                    <RightOutlined style={{ color: '#9ca3af' }} />
                    <span style={{ color: '#60a5fa', fontSize: 16, fontWeight: 600 }}>
                      Worklenz
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {hierarchyRows.map((row, idx) => (
                      <div
                        key={row.asana}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 36px 1.4fr 32px',
                          alignItems: 'center',
                          gap: 12,
                          padding: 10,
                          background: idx % 2 === 0 ? '#0b0e13' : '#0e1116',
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{row.asana}</div>
                        <RightOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
                        <Select
                          value={row.jira}
                          style={{ width: '100%' }}
                          dropdownStyle={{ background: '#0f1117', color: '#e5e7eb' }}
                          options={[
                            { value: row.jira, label: row.jira },
                            { value: 'Status', label: 'Status' },
                          ]}
                        />
                        <Tooltip title="More info">
                          <InfoCircleOutlined style={{ color: '#9ca3af' }} />
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }
        if (reviewSubScreen === 'fieldMapping') {
          // Field mapping sub-screen
          return (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 980 }}>
                <a
                  href="#"
                  style={{ color: '#7aa2f7', display: 'inline-flex', alignItems: 'center' }}
                  onClick={e => {
                    e.preventDefault();
                    setReviewSubScreen('main');
                  }}
                >
                  <RightOutlined
                    style={{ fontSize: 12, marginRight: 6, transform: 'rotate(180deg)' }}
                  />
                  {'Back to review details'}
                </a>
                <Typography.Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>
                  {'Field mapping'}
                </Typography.Title>
                <Typography.Paragraph style={{ marginBottom: 20 }}>
                  {
                    "We've automatically mapped your Asana data into system and custom fields in Worklenz. You can customize some fields that have other compatible field types. More about field mapping"
                  }
                </Typography.Paragraph>

                <div style={{ marginBottom: 16, maxWidth: 340 }}>
                  <Input placeholder={'Search fields'} prefix={<SearchOutlined />} />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1.6fr 140px',
                    color: '#9ca3af',
                    fontWeight: 600,
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ paddingLeft: 6 }}>Asana field</span>
                  <span>Jira field</span>
                  <span style={{ textAlign: 'center' }}>Include in import</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {fieldMappingRows.map((row, idx) => (
                    <div
                      key={row.asana}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 1.6fr 140px',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        background: idx % 2 === 0 ? '#0b0e13' : '#0e1116',
                        borderRadius: 10,
                        border: '1px solid #1e2633',
                      }}
                    >
                      <span style={{ color: '#e5e7eb', paddingLeft: 6 }}>{row.asana}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Select
                          value={row.jira}
                          style={{ width: '100%' }}
                          dropdownStyle={{ background: '#0f1117', color: '#e5e7eb' }}
                          options={[{ value: row.jira, label: row.jira }]}
                        />
                        {row.required && (
                          <span
                            style={{
                              background: '#2d3748',
                              color: '#cbd5e0',
                              fontSize: 10,
                              borderRadius: 6,
                              padding: '2px 6px',
                              letterSpacing: 0.4,
                              textTransform: 'uppercase',
                            }}
                          >
                            Required
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Switch checked={row.include} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }
      }
      if (step === 3) {
        // Step 4: Import data (last step before completion)
        return (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <Typography.Title level={3} style={{ marginBottom: 12 }}>
              {t('importStep.importData', 'Import data')}
            </Typography.Title>
            <Typography.Paragraph>
              {t(
                'importStep.importReady',
                'Review is complete. Click Finish to start the import and we will set up your space.'
              )}
            </Typography.Paragraph>
          </div>
        );
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
                  const parsed = Papa.parse<string[]>(text, { header: true });
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
                Your team’s data from <b>{source?.label || 'your app'}</b> will be imported into
                this space. Check if you’re selecting the right Worklenz space, template, and space
                type as these options can’t be modified later.
              </Typography.Paragraph>
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 20 }}>
                All fields are required
              </div>
              {/* Jira space select */}
              <div style={{ marginBottom: 20 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>
                  Jira space
                </Typography.Text>
                <Select
                  style={{ width: '100%', marginTop: 6 }}
                  defaultValue="software"
                  dropdownStyle={{ background: '#23272f', color: '#fff' }}
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
                  defaultValue="scrum"
                  dropdownStyle={{ background: '#23272f', color: '#fff' }}
                  optionLabelProp="label"
                >
                  <Select.Option value="scrum" label="Scrum">
                    <span role="img" aria-label="Scrum" style={{ marginRight: 8 }}>
                      🏉
                    </span>
                    Scrum
                  </Select.Option>
                  <Select.Option value="kanban" label="Kanban">
                    <span role="img" aria-label="Kanban" style={{ marginRight: 8 }}>
                      🗂️
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
                  placeholder="Project name"
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
              We’ve automatically mapped a few columns from the CSV file to <b>Worklenz fields</b>.
              Verify and{' '}
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
            <Collapse ghost style={{ marginBottom: 16 }} bordered={false} expandIconPosition="left">
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
            {/* Table header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#b0b0b0',
                fontWeight: 500,
                fontSize: 14,
                marginBottom: 4,
                marginTop: 16,
              }}
            >
              <span style={{ flex: 2, paddingLeft: 8 }}>Columns in CSV</span>
              <span style={{ flex: 2 }}>Jira fields</span>
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
                    <Select
                      placeholder="Select a field to map"
                      style={{ width: '100%' }}
                      showSearch
                      value={fieldMappings[col] || undefined}
                      onChange={val => setFieldMappings(m => ({ ...m, [col]: val }))}
                    >
                      <Select.Option value="assignee">Assignee</Select.Option>
                      <Select.Option value="attachment">Attachment</Select.Option>
                      <Select.Option value="comment">Comment</Select.Option>
                      <Select.Option value="created">Created</Select.Option>
                      <Select.Option value="creator">Creator</Select.Option>
                      <Select.Option value="description">Description</Select.Option>
                      <Select.Option value="duedate">Due date</Select.Option>
                      <Select.Option value="environment">Environment</Select.Option>
                      <Select.Option value="issuetype">Issue Type</Select.Option>
                      <Select.Option value="labels">Labels</Select.Option>
                      {/* ...more fields... */}
                      <Select.Option value="custom">Create a new custom field</Select.Option>
                    </Select>
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
        );
      case 3:
        // Map values to work types step
        // Example values and work types (replace with real data as needed)
        const csvValues = ['Bug', 'Story', 'Task'];
        const workTypesList = [
          {
            key: 'bug',
            label: 'Bug',
            icon: <span style={{ color: '#ff4d4f' }}>🪲</span>,
            level: 0,
          },
          {
            key: 'task',
            label: 'Task',
            icon: <span style={{ color: '#4096ff' }}>☑️</span>,
            level: 0,
          },
          {
            key: 'story',
            label: 'Story',
            icon: <span style={{ color: '#22c55e' }}>📗</span>,
            level: 0,
          },
          {
            key: 'epic',
            label: 'Epic',
            icon: <span style={{ color: '#a855f7' }}>💎</span>,
            level: 1,
          },
          {
            key: 'subtask',
            label: 'Sub-task',
            icon: <span style={{ color: '#38bdf8' }}>📝</span>,
            level: -1,
          },
          {
            key: 'todo',
            label: 'To Do',
            icon: <span style={{ color: '#fbbf24' }}>📝</span>,
            level: 0,
          },
          {
            key: 'doing',
            label: 'Doing',
            icon: <span style={{ color: '#3b82f6' }}>🔄</span>,
            level: 0,
          },
          {
            key: 'done',
            label: 'Done',
            icon: <span style={{ color: '#22c55e' }}>✅</span>,
            level: 0,
          },
        ];

        // Filtered values
        const filteredValues = csvValues.filter(
          v =>
            v.toLowerCase().includes(searchValue.toLowerCase()) &&
            (filter === 'all' || (filter === 'mapped' ? workTypeMapping[v] : !workTypeMapping[v]))
        );

        return (
          <div style={{ width: '100%' }}>
            <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
              Map values to work types
            </Typography.Title>
            <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
              Build more structure into your space by mapping values within the Issue Type column to
              Worklenz work types. You can also create new work types based on your space
              permissions.{' '}
              <a href="#" style={{ color: '#4096ff' }}>
                Read about mapping work types
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
                dropdownStyle={{ background: '#23272f', color: '#fff' }}
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
                  📦
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
                  🏷️
                </span>
                Worklenz work types
              </span>
            </div>
            {filteredValues.length === 0 ? (
              <div style={{ color: '#888', margin: '24px 0' }}>No values found.</div>
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
                      dropdownStyle={{ background: '#23272f', color: '#fff' }}
                      dropdownRender={menu => (
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
                              Level {wt.level}
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
                  <span style={{ fontSize: 20, marginRight: 10, color: '#60a5fa' }}>ℹ️</span>
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
                  space. Users without a corresponding email address won’t be imported.
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
                    <span style={{ marginRight: 8 }}>📄</span>Users in CSV ({userRows.length})
                  </span>
                  <span style={{ width: 40 }}></span>
                  <span style={{ flex: 3 }}>
                    <span style={{ marginRight: 8 }}>🛫</span>Users moving to Worklenz (0)
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
        // Example summary values (replace with real state as needed)
        const spaceName = 'worklenz 2'; // TODO: get from state
        const spaceType = 'Kanban'; // TODO: get from state
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
              We’re ready to import your team’s data. Here’s a summary of what’s being imported into
              Worklenz.
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
                    1 Worklenz space: {spaceName}
                  </div>
                  <div style={{ color: '#b0b0b0', fontSize: 15 }}>
                    A team-managed software space ({spaceType}) will be created.
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
        <div style={{ padding: 48, background: themeToken.colorBgLayout, height: '100%' }}>
          <Typography.Title level={2} style={{ color: themeToken.colorText }}>
            {t('auth.asanaTitle', 'Connect Asana to import')}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, fontSize: 16 }}>
            {t(
              'auth.asanaBody',
              'We’ll open Asana’s consent screen to grant access to your projects and tasks.'
            )}
          </Typography.Paragraph>
          {authError && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {authError}
            </Typography.Text>
          )}
          <Button type="primary" size="large" loading={authLoading} onClick={handleAsanaAuth}>
            {t('auth.asanaCta', 'Grant permission')}
          </Button>
          <div style={{ marginTop: 12, color: themeToken.colorTextSecondary }}>
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

    if (lowerKey === 'clickup') {
      return (
        <div style={{ padding: 48, background: themeToken.colorBgLayout, height: '100%' }}>
          <Typography.Title level={2} style={{ color: themeToken.colorText, marginBottom: 12 }}>
            {t('auth.clickupTitle', 'Connect ClickUp workspace')}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, fontSize: 16 }}>
            {t(
              'auth.clickupBody',
              'Choose the ClickUp workspace to connect. We’ll request access to read your spaces, folders, lists, and tasks for import.'
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
              team.spaces.map(space => ({ value: space.id, label: `${team.name} • ${space.name}` }))
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
                space.lists.map(list => ({ value: list.id, label: `${space.name} • ${list.name}` }))
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
      open={open}
      onCancel={onClose}
      footer={null}
      width="1800px"
      style={{
        top: 8,
        maxWidth: '2000px',
        minWidth: 1500,
      }}
      styles={{
        body: {
          minHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <div
        className="import-modal-body"
        style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}
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
          <div className="stepper" style={{ padding: '0 8px', marginBottom: 32 }}>
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
                style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 'auto' }}
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
                  disabled={navigationDisabled}
                >
                  {step === totalSteps - 1
                    ? t('common.finish', 'Finish')
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
