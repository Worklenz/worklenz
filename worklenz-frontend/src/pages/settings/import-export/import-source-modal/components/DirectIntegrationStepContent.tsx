import React from 'react';
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  Button,
  Card,
  Flex,
  InfoCircleOutlined,
  Input,
  PaperClipOutlined,
  RightOutlined,
  SearchOutlined,
  Select,
  Switch,
  TableOutlined,
  TeamOutlined,
  Tooltip,
  Typography,
  message as antdMessage,
} from '@/shared/antd-imports';
import { saveImportFields } from '@/api/imports';

interface DirectIntegrationStepContentProps {
  step: number;
  lowerKey: string;
  isJira: boolean;
  authCompleted: boolean;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  themeToken: any;
  source: { label: string };
  asanaWorkspaces: Array<{ id: string; name: string }>;
  clickupTeams: Array<{
    id: string;
    name: string;
    spaces: Array<{ id: string; name: string; lists: Array<{ id: string; name: string }> }>;
  }>;
  jiraProjects: Array<{ key: string; name: string }>;
  asanaProjects: Array<{ id: string; name: string; workspaceId?: string }>;
  selectedWorkspace: string;
  setSelectedWorkspace: React.Dispatch<React.SetStateAction<string>>;
  setSelectedProject: React.Dispatch<React.SetStateAction<string>>;
  jiraDomain: string;
  selectedBoard: string;
  setSelectedBoard: React.Dispatch<React.SetStateAction<string>>;
  selectedTrelloBoard: string;
  setSelectedTrelloBoard: React.Dispatch<React.SetStateAction<string>>;
  trelloBoards: Array<{ id: string; name: string }>;
  mondayBoards: Array<{ id: string; name: string }>;
  job: { id: string } | null;
  updateImportSource: (jobId: string, payload: any) => Promise<any>;
  runAutoMapping: (suppressToast?: boolean) => Promise<void>;
  message: any;
  selectedClickupList: string;
  setSelectedClickupList: React.Dispatch<React.SetStateAction<string>>;
  selectedClickupSpace: string;
  selectedJiraProject: string;
  setSelectedJiraProject: React.Dispatch<React.SetStateAction<string>>;
  persistAsanaSelection: (projectId: string, workspaceId?: string, projectName?: string) => Promise<void>;
  selectedProject: string;
  spaceName: string;
  setSpaceName: React.Dispatch<React.SetStateAction<string>>;
  reviewSubScreen: 'main' | 'hierarchy' | 'fieldMapping';
  setReviewSubScreen: React.Dispatch<React.SetStateAction<'main' | 'hierarchy' | 'fieldMapping'>>;
  hierarchyCount: number;
  mappedFieldCount: number;
  fieldMappingRows: Array<{ source_field: string; target_field: string; required?: boolean; include?: boolean }>;
  importMembers: boolean;
  setImportMembers: React.Dispatch<React.SetStateAction<boolean>>;
  importAttachments: boolean;
  setImportAttachments: React.Dispatch<React.SetStateAction<boolean>>;
  hierarchyDisplayRows: Array<{ source_level: string; target_level: string; position?: number }>;
  setHierarchyRows: React.Dispatch<React.SetStateAction<Array<{ source_level: string; target_level: string; position?: number }>>>;
  worklenzFieldOptions: Array<{ value: string; label: string }>;
  setFieldMappingRows: React.Dispatch<
    React.SetStateAction<Array<{ source_field: string; target_field: string; required?: boolean; include?: boolean }>>
  >;
}

export const DirectIntegrationStepContent: React.FC<DirectIntegrationStepContentProps> = props => {
  const {
    step,
    lowerKey,
    isJira,
    authCompleted,
    t,
    themeToken,
    source,
    asanaWorkspaces,
    clickupTeams,
    jiraProjects,
    asanaProjects,
    selectedWorkspace,
    setSelectedWorkspace,
    setSelectedProject,
    jiraDomain,
    selectedBoard,
    setSelectedBoard,
    selectedTrelloBoard,
    setSelectedTrelloBoard,
    trelloBoards,
    mondayBoards,
    job,
    updateImportSource,
    runAutoMapping,
    message,
    selectedClickupList,
    setSelectedClickupList,
    selectedClickupSpace,
    selectedJiraProject,
    setSelectedJiraProject,
    persistAsanaSelection,
    selectedProject,
    spaceName,
    setSpaceName,
    reviewSubScreen,
    setReviewSubScreen,
    hierarchyCount,
    mappedFieldCount,
    fieldMappingRows,
    importMembers,
    setImportMembers,
    importAttachments,
    setImportAttachments,
    hierarchyDisplayRows,
    setHierarchyRows,
    worklenzFieldOptions,
    setFieldMappingRows,
  } = props;

  const humanizeFieldKey = React.useCallback((raw: string) => {
    // Fallback for custom/unrecognized field keys: "startDate" -> "Start Date", "due_date" -> "Due date".
    const spaced = String(raw || '')
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
      .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();

    if (!spaced) return raw;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }, []);

  const CREATE_CUSTOM_FIELD_PREFIX = '__create_custom__:';
  const toCustomFieldKey = React.useCallback((name: string) => {
    const normalized = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized ? normalized : 'custom_field';
  }, []);

  const worklenzFieldLabelByValue = React.useMemo(() => {
    return new Map(worklenzFieldOptions.map(option => [option.value, option.label]));
  }, [worklenzFieldOptions]);

  const recommendedTargets = React.useMemo(() => {
    return new Set([
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
  }, []);

  const [fieldMappingSearchValue, setFieldMappingSearchValue] = React.useState('');
  const [showIncludedOnly, setShowIncludedOnly] = React.useState(true);

  const directContainerStyle = {
    width: '100%',
    maxWidth: 820,
    margin: '0 auto',
    background: themeToken.colorBgContainer,
    borderRadius: 12,
    padding: 32,
  };

  const renderLabelWithTooltip = (label: string, tooltip: string, ariaLabel: string) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span>{label}</span>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined
          aria-label={ariaLabel}
          style={{ color: themeToken.colorPrimary, cursor: 'help' }}
        />
      </Tooltip>
    </span>
  );

  if (step === 0) {
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
            {t('importStep.selectList', { defaultValue: 'Select a source' })}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary }}>
            {isJira
              ? t('importStep.jiraSelectProjectHelp', {
                  defaultValue:
                    'Select the Jira site and project you would like to import from. Required fields are marked with an asterisk.',
                })
              : t('importStep.selectListHelp', {
                  defaultValue:
                    "Select the workspace and list/board you'd like to import data from. Required fields are marked with an asterisk.",
                })}
          </Typography.Paragraph>
          <div style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
            {!isJira && lowerKey !== 'monday' && lowerKey !== 'trello' && (
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
                  {renderLabelWithTooltip(
                    t('importStep.jiraDomain', { defaultValue: 'Domain' }),
                    t('importStep.jiraDomainSelectionTooltip', {
                      defaultValue:
                        'This is the Jira site you authenticated with. The project list below comes from this domain.',
                    }),
                    t('importStep.jiraDomainSelectionTooltipAriaLabel', {
                      defaultValue: 'Information about the Jira domain field',
                    })
                  )}
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
                  ? renderLabelWithTooltip(
                      t('importStep.jiraProjectLabel', { defaultValue: 'Project *' }),
                      t('importStep.jiraProjectSelectionTooltip', {
                        defaultValue:
                          'Choose the Jira project to import. We use this selection to fetch issues, fields, and mappings for the import.',
                      }),
                      t('importStep.jiraProjectSelectionTooltipAriaLabel', {
                        defaultValue: 'Information about the Jira project selector',
                      })
                    )
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
                    message.error(err?.message || t('importStep.autoMapError', 'Auto-mapping failed'));
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
                  .flatMap(space => space.lists.map(list => ({ value: list.id, label: list.name })))}
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
                      projectName,
                    });
                    await runAutoMapping();
                  } catch (err: any) {
                    message.error(err?.message || t('importStep.autoMapError', 'Auto-mapping failed'));
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
                    message.error(err?.message || t('importStep.autoMapError', 'Auto-mapping failed'));
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={directContainerStyle}>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            {t('importStep.setupProjectTitle', { defaultValue: 'Set up a project in Worklenz' })}
          </Typography.Title>
          <Typography.Paragraph style={{ color: themeToken.colorTextSecondary }}>
            {t('importStep.setupProjectDesc', {
              defaultValue:
                "Your team's data from {{source}} will be imported into a new project. Check the project name before continuing.",
              source: source.label || 'your app',
            })}
          </Typography.Paragraph>
          <div style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
              {t('importStep.projectNameLabel', { defaultValue: 'Project name' })}
            </label>
            <Input
              style={{ width: '100%', marginBottom: 8 }}
              placeholder={t('importStep.projectNamePlaceholder', {
                defaultValue: 'Enter a project name',
              })}
              value={spaceName}
              onChange={e => setSpaceName(e.target.value)}
            />
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 10, fontSize: 12 }}>
              {t('importStep.requiredProjectNameHint', {
                defaultValue: 'Required now: project name.',
              })}
            </Typography.Text>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    if (reviewSubScreen === 'main') {
      const reviewCards = [
        {
          key: 'hierarchy',
          title: t('importStep.projectHierarchy', { defaultValue: 'Project hierarchy' }),
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
          control: (
            <RightOutlined style={{ color: themeToken.colorTextSecondary, fontSize: 16 }} />
          ),
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
          control: (
            <RightOutlined style={{ color: themeToken.colorTextSecondary, fontSize: 16 }} />
          ),
        },
        {
          key: 'importMembers',
          title: t('importStep.importMembers', {
            defaultValue: 'Import all members from {{source}} project',
            source: source.label || 'source',
          }),
          description: t('importStep.importMembersDesc', { defaultValue: 'Brings collaborators into the Worklenz project' }),
          iconBg: '#0f9d58',
          icon: <TeamOutlined style={{ color: '#fff' }} />,
          action: undefined,
          control: <Switch checked={importMembers} onChange={setImportMembers} />,
        },
        {
          key: 'importAttachments',
          title: t('importStep.importAttachments', 'Import all attachments'),
          description: t('importStep.importAttachmentsDesc', 'Pulls files and images from tasks'),
          iconBg: '#f59e0b',
          icon: <PaperClipOutlined style={{ color: '#fff' }} />,
          action: undefined,
          control: <Switch checked={importAttachments} onChange={setImportAttachments} />,
        },
      ];

      return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ ...directContainerStyle, minHeight: 469 }}>
            <Typography.Title level={3} style={{ marginBottom: 8 }}>
              {t('importStep.reviewDetailsTitle', 'Review details')}
            </Typography.Title>
            <Typography.Paragraph style={{ color: themeToken.colorTextSecondary }}>
              {t(
                'importStep.reviewDetailsDesc',
                "We've mapped your project and you're ready to import. Here's how the {{source}} data will be imported into the {{target}} project. Learn more about the project setup",
                {
                  source: source.label || 'source',
                  target: spaceName || t('importStep.defaultProjectName', { defaultValue: 'Imported project' }),
                }
              )}
            </Typography.Paragraph>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
              {reviewCards.map(card => (
                <Card
                  key={card.key}
                  onClick={card.action}
                  style={{
                    borderRadius: 12,
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
                      <div style={{ color: themeToken.colorTextHeading, fontWeight: 600, fontSize: 16 }}>
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
            <div
              style={{
                marginTop: 14,
                borderRadius: 12,
                border: `1px solid ${themeToken.colorBorder}`,
                background: themeToken.colorFillQuaternary || themeToken.colorBgContainer,
                padding: '14px 16px',
              }}
            >
              <Typography.Text style={{ color: themeToken.colorText, fontWeight: 600 }}>
                {t('importStep.importLimitationsTitle', {
                  defaultValue: 'Import limitations',
                })}
              </Typography.Text>
              <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, margin: '6px 0 10px' }}>
                {t('importStep.importLimitationsDescription', {
                  defaultValue: 'Heads up before importing from {{source}}:',
                  source: source.label || 'your source',
                })}
              </Typography.Paragraph>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(
                  lowerKey === 'jira'
                    ? [
                      t('importStep.limitationsJiraCommentFormat', {
                        defaultValue: 'Rich-text comments are imported as plain text when advanced formatting is not supported.',
                      }),
                      t('importStep.limitationsJiraAttachmentPermission', {
                        defaultValue: 'Attachments can be skipped if source file permissions or URLs are inaccessible.',
                      }),
                      t('importStep.limitationsJiraUserAttribution', {
                        defaultValue: 'Comment and assignee attribution depends on matching users by email or mapped identity.',
                      }),
                    ]
                    : lowerKey === 'asana'
                      ? [
                        t('importStep.limitationsAsanaSections', {
                          defaultValue: 'Section values are mapped to statuses and may require manual refinement.',
                        }),
                        t('importStep.limitationsAsanaLikes', {
                          defaultValue: 'Likes are imported as field values; reactions do not create social activity in Worklenz.',
                        }),
                        t('importStep.limitationsAsanaUsers', {
                          defaultValue: 'Users who are not added to the team remain unresolved in assignee and reporter mappings.',
                        }),
                      ]
                      : [
                        t('importStep.limitationsGenericMapping', {
                          defaultValue: 'Field mappings may require manual adjustment after import.',
                        }),
                        t('importStep.limitationsGenericUsers', {
                          defaultValue: 'Unmatched users remain unresolved until they are added and mapped in Worklenz.',
                        }),
                        t('importStep.limitationsGenericAttachments', {
                          defaultValue: 'Attachment import depends on source permissions and provider API availability.',
                        }),
                      ]
                ).map((item, index) => (
                  <Typography.Text key={`${item}-${index}`} style={{ color: themeToken.colorTextSecondary }}>
                    • {item}
                  </Typography.Text>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (reviewSubScreen === 'hierarchy') {
      const panelBg = themeToken.colorBgContainer;
      const panelBorder = themeToken.colorBorder;
      const subtleFill = themeToken.colorFillQuaternary || themeToken.colorFillSecondary;
      const subtleBorder = themeToken.colorBorderSecondary || themeToken.colorBorder;

      return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%',
              maxWidth: 820,
              minHeight: 469,
              background: panelBg,
              borderRadius: 10,
              border: `1px solid ${panelBorder}`,
              padding: '40px 40px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <a
                href="#"
                style={{
                  color: themeToken.colorPrimary,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={e => {
                  e.preventDefault();
                  setReviewSubScreen('main');
                }}
              >
                <RightOutlined style={{ fontSize: 12, marginRight: 6, transform: 'rotate(180deg)' }} />
                {t('importStep.backToReview', 'Back to review details')}
              </a>
              <div style={{ flex: 1 }} />
              <Button
                type="primary"
                onClick={async () => {
                  setReviewSubScreen('main');
                  antdMessage.success(t('importStep.hierarchySaved', 'Hierarchy mapping saved.'));
                }}
              >
                {t('common.save', 'Save')}
              </Button>
            </div>

            <Typography.Title level={3} style={{ margin: '0 0 4px' }}>
              {t('importStep.projectHierarchy', { defaultValue: 'Project hierarchy' })}
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 16, color: themeToken.colorTextSecondary }}>
              {t(
                'importStep.hierarchyIntro',
                `How we've mapped your ${source.label} data to Worklenz. More about project hierarchy in Worklenz.`
              )}
            </Typography.Paragraph>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: themeToken.colorErrorBg,
                  color: themeToken.colorErrorText,
                  fontWeight: 600,
                }}
              >
                {source.label}
              </span>
              <span style={{ fontSize: 16, color: themeToken.colorText }}>→</span>
              <span
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: themeToken.colorInfoBg,
                  color: themeToken.colorInfoText,
                  fontWeight: 700,
                }}
              >
                Worklenz
              </span>
            </div>

            <div
              style={{
                background: panelBg,
                borderRadius: 12,
                border: `1px solid ${subtleBorder}`,
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
                    background: subtleFill,
                    borderRadius: 10,
                    border: `1px solid ${subtleBorder}`,
                  }}
                >
                  <div style={{ color: themeToken.colorText, fontWeight: 600, fontSize: 15 }}>
                    {row.source_level}
                  </div>
                  <RightOutlined
                    style={{ color: themeToken.colorTextSecondary, fontSize: 12 }}
                  />
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
                          currentIdx === idx ? { ...current, target_level: value as string } : current
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
      const fieldMappingTitle = t('importStep.fieldMappingTitle', 'Field mapping');
      const fieldMappingDescription = t(
        'importStep.fieldMappingDescription',
        "We've automatically mapped your {{source}} data into system and custom fields in Worklenz. You can customize some fields that have other compatible field types. More about field mapping.",
        { source: source.label || 'source' }
      );
      const panelBg = themeToken.colorBgContainer;
      const panelBorder = themeToken.colorBorder;
      const sectionBg = themeToken.colorBgElevated;
      const headerBg = themeToken.colorFillAlter;
      const rowAltBg = themeToken.colorFillQuaternary;

      const normalizedSearch = fieldMappingSearchValue.trim().toLowerCase();
      const visibleRows = fieldMappingRows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => {
          const isIncluded = row.required ? true : row.include !== false;
          if (showIncludedOnly && !isIncluded) return false;
          if (!normalizedSearch) return true;

          const targetLabel =
            worklenzFieldLabelByValue.get(row.target_field) ||
            humanizeFieldKey(row.target_field || '');
          return (
            String(row.source_field || '').toLowerCase().includes(normalizedSearch) ||
            String(row.target_field || '').toLowerCase().includes(normalizedSearch) ||
            String(targetLabel || '').toLowerCase().includes(normalizedSearch)
          );
        });

      return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: 820,
              maxWidth: 820,
              minWidth: 820,
              height: 657.26,
              minHeight: 657.26,
              background: panelBg,
              borderRadius: 10,
              border: `1px solid ${panelBorder}`,
              padding: '14px 32px 40px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              margin: '0 auto 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <a
                href="#"
                style={{
                  color: themeToken.colorPrimary,
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
              <Button
                type="primary"
                onClick={async () => {
                  if (job?.id && fieldMappingRows.length) {
                    try {
                      await saveImportFields(job.id, fieldMappingRows as any);
                      antdMessage.success(t('importStep.fieldMappingSaved', 'Field mapping saved.'));
                    } catch {
                      antdMessage.error(t('importStep.fieldMappingSaveError', 'Failed to save field mapping.'));
                      return;
                    }
                  }
                  setReviewSubScreen('main');
                }}
              >
                {t('common.save', 'Save')}
              </Button>
            </div>

            <div>
              <Typography.Title
                level={3}
                style={{
                  margin: '0 0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: themeToken.colorTextHeading,
                }}
              >
                {fieldMappingTitle}
              </Typography.Title>
              <Typography.Paragraph style={{ margin: 0, color: themeToken.colorTextSecondary }}>
                {fieldMappingDescription}
              </Typography.Paragraph>
            </div>

            <Flex
              style={{ marginTop: 20, marginBottom: 16 }}
              align="center"
              justify="space-between"
              gap={12}
              wrap
            >
              <Input
                placeholder={t('importStep.searchFields', 'Search fields')}
                prefix={<SearchOutlined />}
                value={fieldMappingSearchValue}
                allowClear
                onChange={e => setFieldMappingSearchValue(e.target.value)}
                aria-label={t('importStep.searchFields', { defaultValue: 'Search fields' })}
                style={{
                  width: '100%',
                  maxWidth: 560,
                  background: sectionBg,
                  borderColor: panelBorder,
                  color: themeToken.colorText,
                }}
              />
              <Flex align="center" gap={12} wrap>
                <Switch checked={showIncludedOnly} onChange={setShowIncludedOnly} />
                <Typography.Text style={{ color: themeToken.colorTextSecondary }}>
                  {t('importStep.showIncludedOnly', { defaultValue: 'Show included only' })}
                </Typography.Text>
                <Button
                  onClick={() =>
                    setFieldMappingRows(rows =>
                      rows.map(row => ({
                        ...row,
                        include: !!row.required || recommendedTargets.has(row.target_field),
                      }))
                    )
                  }
                >
                  {t('importStep.resetRecommended', { defaultValue: 'Reset to recommended' })}
                </Button>
              </Flex>
            </Flex>

            <div
              style={{
                background: sectionBg,
                borderRadius: 12,
                border: `1px solid ${panelBorder}`,
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
                  background: headerBg,
                  color: themeToken.colorTextSecondary,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <span style={{ paddingLeft: 2 }}>
                  {t('importStep.sourceField', { defaultValue: '{{source}} field', source: source.label || 'Source' })}
                </span>
                <span>{t('importStep.worklenzField', 'Worklenz field')}</span>
                <span style={{ textAlign: 'center' }}>{t('importStep.includeInImport', 'Include in import')}</span>
              </div>

              {fieldMappingRows.length === 0 ? (
                <div style={{ padding: '14px 16px', color: themeToken.colorTextSecondary, fontWeight: 500 }}>
                  {t('importStep.autoMapPlaceholder', 'Auto-mapping will populate fields here.')}
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
                  {visibleRows.map(({ row, index: rowIndex }) => {
                    const hasKnownLabel = worklenzFieldLabelByValue.has(row.target_field);
                    const isCustomFieldCandidate =
                      !!row.target_field && !worklenzFieldLabelByValue.has(row.target_field);

                    const selectedOption =
                      row.target_field && !hasKnownLabel
                        ? [
                            {
                              value: row.target_field,
                              label:
                                worklenzFieldLabelByValue.get(row.target_field) ||
                                humanizeFieldKey(row.target_field),
                            },
                          ]
                        : [];

                    const systemOptions = worklenzFieldOptions.map(option => ({
                      value: option.value,
                      label: option.label,
                      searchLabel: String(option.label || option.value).toLowerCase(),
                    }));

                    const customCreateOption = {
                      value: `${CREATE_CUSTOM_FIELD_PREFIX}${row.source_field}`,
                      label: t('importStep.createCustomField', {
                        defaultValue: 'Create custom field: {{name}}',
                        name: row.source_field,
                      }),
                      searchLabel: String(row.source_field || '').toLowerCase(),
                    };

                    const options = [
                      ...(selectedOption.length
                        ? [
                            {
                              label: t('importStep.selectedField', {
                                defaultValue: 'Selected',
                              }),
                              options: selectedOption.map(option => ({
                                ...option,
                                searchLabel: String(option.label || option.value).toLowerCase(),
                              })),
                            },
                          ]
                        : []),
                      {
                        label: t('importStep.worklenzFields', {
                          defaultValue: 'Worklenz fields',
                        }),
                        options: systemOptions,
                      },
                      {
                        label: t('importStep.customFields', {
                          defaultValue: 'Custom fields',
                        }),
                        options: [customCreateOption],
                      },
                    ];

                    return (
                      <div
                        key={`${row.source_field}-${rowIndex}`}
                      style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1.5fr 150px',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          background: rowIndex % 2 === 0 ? sectionBg : rowAltBg,
                          borderTop: `1px solid ${panelBorder}`,
                        }}
                      >
                        <span style={{ color: themeToken.colorText, paddingLeft: 2, fontWeight: 600 }}>
                          {row.source_field}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Select
                            value={row.target_field}
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="searchLabel"
                            options={options}
                            onChange={value =>
                              setFieldMappingRows(rows =>
                                rows.map((current, currentIdx) =>
                                  currentIdx === rowIndex
                                    ? (() => {
                                        const nextValue = value as string;
                                        if (nextValue.startsWith(CREATE_CUSTOM_FIELD_PREFIX)) {
                                          const customFieldName = nextValue
                                            .slice(CREATE_CUSTOM_FIELD_PREFIX.length)
                                            .trim();
                                          const normalized = toCustomFieldKey(customFieldName);
                                          return {
                                            ...current,
                                            target_field: normalized,
                                            include: true,
                                          };
                                        }
                                        return { ...current, target_field: nextValue };
                                      })()
                                    : current
                                )
                              )
                            }
                          />
                          {isCustomFieldCandidate && (
                            <Typography.Text style={{ color: themeToken.colorPrimary, fontSize: 12 }}>
                              {t('importStep.customFieldWillBeCreated', {
                                defaultValue: 'Will create custom field',
                              })}
                            </Typography.Text>
                          )}
                          {row.required && (
                            <span
                              style={{
                                background: themeToken.colorInfoBg,
                                color: themeToken.colorInfoText,
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
                            checked={row.required ? true : row.include !== false}
                            disabled={!!row.required}
                            onChange={checked =>
                              setFieldMappingRows(rows =>
                                rows.map((current, currentIdx) =>
                                  currentIdx === rowIndex ? { ...current, include: checked } : current
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
};
