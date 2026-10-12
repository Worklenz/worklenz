import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Flex,
  Modal,
  Radio,
  Skeleton,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  CompanyUser,
  useGetClientProjectsListQuery,
  useSetCompanyUserProjectsMutation,
} from '@/api/client-portal/company-users-api';
import {
  PERMISSION_LEVELS,
  PERMISSION_TEMPLATES,
  PermissionLevel,
  ProjectAccessMap,
  applyLevelToSelection,
  applyPermissionTemplate,
  toProjectAccessPayload,
  toggleSelectAll,
} from '@/lib/client-portal/client-permissions';
import { getApiErrorMessage } from './company-users-helpers';

const { Text } = Typography;

interface AssignProjectsModalProps {
  user: CompanyUser | null;
  open: boolean;
  onClose: () => void;
}

const toAccessMap = (user: CompanyUser): ProjectAccessMap =>
  user.projects.reduce<ProjectAccessMap>((map, project) => {
    map[project.project_id] = project.level;
    return map;
  }, {});

/**
 * Per-project access for one company user: tick the projects they can see and pick a Permission
 * Level on each, or apply a template that sets one level on every current project of the company.
 */
export const AssignProjectsModal = ({ user, open, onClose }: AssignProjectsModalProps) => {
  const { t } = useTranslation('client-portal-company-users');
  const { token } = theme.useToken();
  const [access, setAccess] = useState<ProjectAccessMap>({});

  const { data, isLoading, isError, refetch } = useGetClientProjectsListQuery(
    { clientId: user?.client_id ?? '' },
    { skip: !open || !user }
  );
  const [saveProjects, { isLoading: isSaving }] = useSetCompanyUserProjectsMutation();

  const projects = useMemo(() => data?.body?.projects ?? [], [data]);
  const projectIds = useMemo(() => projects.map(project => project.id), [projects]);
  const totalProjects = data?.body?.total ?? 0;

  // Seed the selection when the modal opens for a user, not on every refetch of the list behind it.
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => {
    if (open && userRef.current) setAccess(toAccessMap(userRef.current));
  }, [open, user?.id]);

  const hasNoProjects = !isLoading && !isError && projects.length === 0;
  // Saving replaces the whole list, so it must not run when some of the projects could not be shown.
  const isTruncated = !isLoading && totalProjects > projects.length;
  const selectedCount = projectIds.filter(projectId => projectId in access).length;
  const isAllSelected = projects.length > 0 && selectedCount === projects.length;

  const levelLabel = (level: PermissionLevel) => {
    const definition = PERMISSION_LEVELS.find(item => item.key === level);
    return definition
      ? t(definition.labelKey, { defaultValue: definition.labelDefault })
      : t('permissionLevels.unknown', { defaultValue: 'Unknown level' });
  };

  const setLevel = (projectId: string, level: PermissionLevel) =>
    setAccess(previous => ({ ...previous, [projectId]: level }));

  const toggleProject = (projectId: string, checked: boolean) =>
    setAccess(previous => {
      const next = { ...previous };
      if (checked) next[projectId] = previous[projectId] ?? 'view';
      else delete next[projectId];
      return next;
    });

  const handleSave = async () => {
    if (!user) return;

    // Only ids the list actually shows are sent, so a project that left the company is dropped.
    const selection = projectIds.reduce<ProjectAccessMap>((map, projectId) => {
      if (projectId in access) map[projectId] = access[projectId];
      return map;
    }, {});

    try {
      await saveProjects({ id: user.id, projects: toProjectAccessPayload(selection) }).unwrap();
      message.success(
        t('assignProjects.savedMessage', {
          name: user.name,
          defaultValue: 'Project access updated for {{name}}.',
        })
      );
      onClose();
    } catch (error) {
      message.error(
        getApiErrorMessage(error) ||
          t('assignProjects.saveError', { defaultValue: 'Could not update project access.' })
      );
    }
  };

  const renderBody = () => {
    if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

    if (isError) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('assignProjects.loadError', {
            defaultValue: 'Could not load this company’s projects.',
          })}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('retryButton', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }

    return (
      <Flex vertical gap={16}>
        <Text type="secondary">
          {t('assignProjects.helper', {
            company: user?.company_name,
            name: user?.name,
            defaultValue:
              'Pick which of {{company}}’s projects {{name}} can access, and their permission level on each. A project can be assigned to many company users.',
          })}
        </Text>

        {hasNoProjects && (
          <Alert
            type="info"
            showIcon
            message={t('assignProjects.noProjectsTitle', {
              company: user?.company_name,
              defaultValue: '{{company}} has no projects yet',
            })}
            description={t('assignProjects.noProjectsDescription', {
              defaultValue:
                'Assign a project to this company first, then come back to give this user access. Permission templates need at least one project to apply to.',
            })}
          />
        )}

        {isTruncated && (
          <Alert
            type="warning"
            showIcon
            message={t('assignProjects.truncatedMessage', {
              shown: projects.length,
              total: totalProjects,
              defaultValue:
                'Only {{shown}} of {{total}} projects are shown, so access can’t be edited here.',
            })}
          />
        )}

        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('assignProjects.templatesTitle', {
              defaultValue: 'Apply a template (sets every project below to that level)',
            })}
          </Text>
          <Flex gap={8} wrap="wrap">
            {PERMISSION_TEMPLATES.map(template => (
              <Tooltip
                key={template.key}
                title={t(template.descriptionKey, { defaultValue: template.descriptionDefault })}
              >
                <Button
                  size="small"
                  disabled={hasNoProjects || isTruncated}
                  onClick={() => setAccess(applyPermissionTemplate(template, projectIds))}
                >
                  {t(template.nameKey, { defaultValue: template.nameDefault })}
                </Button>
              </Tooltip>
            ))}
          </Flex>
        </div>

        {projects.length > 0 && (
          <Flex justify="space-between" align="center">
            <Checkbox
              checked={isAllSelected}
              indeterminate={selectedCount > 0 && !isAllSelected}
              disabled={isTruncated}
              onChange={() => setAccess(previous => toggleSelectAll(previous, projectIds))}
            >
              {t('assignProjects.selectAll', { defaultValue: 'Select all' })}
            </Checkbox>
            <Text type="secondary">
              {t('assignProjects.selectedCount', {
                selected: selectedCount,
                total: projects.length,
                defaultValue: '{{selected}} of {{total}} selected',
              })}
            </Text>
          </Flex>
        )}

        {selectedCount > 0 && (
          <Flex
            align="center"
            gap={8}
            wrap="wrap"
            style={{
              padding: '8px 12px',
              borderRadius: token.borderRadius,
              background: token.colorPrimaryBg,
              border: `1px solid ${token.colorPrimaryBorder}`,
            }}
          >
            <Text style={{ fontSize: 13 }}>
              {t('assignProjects.bulkLabel', {
                count: selectedCount,
                defaultValue: 'Set access for {{count}} selected:',
              })}
            </Text>
            {PERMISSION_LEVELS.map(level => (
              <Tooltip
                key={level.key}
                title={t(level.descriptionKey, { defaultValue: level.descriptionDefault })}
              >
                <Button
                  size="small"
                  onClick={() =>
                    setAccess(previous =>
                      // Only the selected projects are in the map, so this leaves the rest alone.
                      applyLevelToSelection(previous, level.key)
                    )
                  }
                >
                  {t(level.labelKey, { defaultValue: level.labelDefault })}
                </Button>
              </Tooltip>
            ))}
          </Flex>
        )}

        <Flex vertical gap={8} style={{ maxHeight: 320, overflowY: 'auto' }}>
          {projects.map(project => {
            const isSelected = project.id in access;
            return (
              <div
                key={project.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: token.borderRadius,
                  border: `1px solid ${
                    isSelected ? token.colorPrimaryBorder : token.colorBorderSecondary
                  }`,
                }}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={isTruncated}
                  onChange={event => toggleProject(project.id, event.target.checked)}
                >
                  <Text strong>{project.name}</Text>
                </Checkbox>

                {isSelected && (
                  <Radio.Group
                    // One native radio group per project, so choosing a level on one project
                    // can never uncheck another project's level.
                    name={`permission-level-${project.id}`}
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                    disabled={isTruncated}
                    value={access[project.id]}
                    onChange={event => setLevel(project.id, event.target.value as PermissionLevel)}
                    aria-label={t('assignProjects.levelFor', {
                      project: project.name,
                      defaultValue: 'Permission level for {{project}}',
                    })}
                    style={{ display: 'block', marginTop: 8, marginInlineStart: 24 }}
                  >
                    {PERMISSION_LEVELS.map(level => (
                      <Tooltip
                        key={level.key}
                        title={t(level.descriptionKey, { defaultValue: level.descriptionDefault })}
                      >
                        <Radio.Button value={level.key}>{levelLabel(level.key)}</Radio.Button>
                      </Tooltip>
                    ))}
                  </Radio.Group>
                )}
              </div>
            );
          })}
        </Flex>
      </Flex>
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnHidden
      width={560}
      title={t('assignProjects.title', {
        name: user?.name,
        defaultValue: 'Assign projects — {{name}}',
      })}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('cancelButton', { defaultValue: 'Cancel' })}
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={isSaving}
          disabled={isLoading || isError || hasNoProjects || isTruncated}
          onClick={handleSave}
        >
          {t('assignProjects.saveButton', { defaultValue: 'Save access' })}
        </Button>,
      ]}
    >
      {renderBody()}
    </Modal>
  );
};
