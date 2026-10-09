import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Modal, Select, Spin, Switch, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { projectsApiService } from '@/api/projects/projects.api.service';
import logger from '@/utils/errorLogger';

interface CopyTaskToProjectModalProps {
  open: boolean;
  sourceProjectId?: string;
  taskTitle?: string;
  confirmLoading?: boolean;
  hasDependencies?: boolean;
  onCompare: (destinationProjectId: string) => Promise<Partial<ProjectCopyDifferences>>;
  onClose: () => void;
  onConfirm: (destinationProjectId: string, confirmedDifferences: boolean, includeDependencies: boolean) => void | Promise<void>;
}

interface DestinationProject {
  id: string;
  name: string;
  color_code?: string;
}

interface StatusMappingInfo {
  isMissing: boolean;
  sourceStatusName: string | null;
  sourceCategoryName: string | null;
  destinationStatusName: string | null;
  destinationCategoryName: string | null;
}

interface ProjectCopyDifferences {
  hasDifferences: boolean;
  missingDefaultColumns: Array<{ name: string; key: string }>;
  missingCustomColumns: Array<{ name: string; key: string }>;
  missingPhases: Array<{ id: string; name: string }>;
  statusMapping?: StatusMappingInfo | null;
}

const normalizeCompareResult = (
  result: Partial<ProjectCopyDifferences>
): ProjectCopyDifferences => {
  const missingDefaultColumns = result.missingDefaultColumns ?? [];
  const missingCustomColumns = result.missingCustomColumns ?? [];
  const missingPhases = result.missingPhases ?? [];
  const statusMapping = result.statusMapping ?? null;
  const isStatusMissing = Boolean(statusMapping?.isMissing);

  return {
    missingDefaultColumns,
    missingCustomColumns,
    missingPhases,
    statusMapping,
    hasDifferences:
      Boolean(result.hasDifferences) ||
      missingDefaultColumns.length > 0 ||
      missingCustomColumns.length > 0 ||
      missingPhases.length > 0 ||
      isStatusMissing,
  };
};

const CopyTaskToProjectModal = ({
  open,
  sourceProjectId,
  taskTitle,
  confirmLoading = false,
  hasDependencies = false,
  onCompare,
  onClose,
  onConfirm,
}: CopyTaskToProjectModalProps) => {
  const { t } = useTranslation('task-duplicate');
  const [projects, setProjects] = useState<DestinationProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [checkingDifferences, setCheckingDifferences] = useState(false);
  const [reviewingDifferences, setReviewingDifferences] = useState(false);
  const [differences, setDifferences] = useState<ProjectCopyDifferences>();
  const [includeDifferences, setIncludeDifferences] = useState(true);
  const [includeDependencies, setIncludeDependencies] = useState(true);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setSelectedProjectId(undefined);
    setReviewingDifferences(false);
    setDifferences(undefined);
    setError(false);
    setIncludeDifferences(true);
    setIncludeDependencies(true);
    setCheckingDifferences(false);
    setLoading(true);

    projectsApiService
      .getMyProjectsToTasks()
      .then(response => {
        if (!isMounted) return;
        setProjects(
          (response.body || [])
            .filter((project): project is DestinationProject => Boolean(project.id && project.name))
            .filter(project => project.id !== sourceProjectId)
        );
      })
      .catch(fetchError => {
        logger.error('Failed to load destination projects', fetchError);
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, sourceProjectId]);

  const projectOptions = useMemo(
    () =>
      projects.map(project => ({
        value: project.id,
        label: (
          <span className="flex items-center gap-2">
            {project.color_code && (
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: project.color_code }}
              />
            )}
            <span>{project.name}</span>
          </span>
        ),
        searchLabel: project.name,
      })),
    [projects]
  );

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setCheckingDifferences(true);
    try {
      const result = await onCompare(projectId);
      setDifferences(normalizeCompareResult(result));
      setReviewingDifferences(true);
    } catch (compareError) {
      logger.error('Failed to compare destination project', compareError);
      setError(true);
    } finally {
      setCheckingDifferences(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('copyToProject.title', { defaultValue: 'Copy task to project' })}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button
          key="cancel"
          onClick={onClose}
          disabled={confirmLoading || checkingDifferences}
        >
          {t('copyToProject.cancel', { defaultValue: 'Cancel' })}
        </Button>,
        reviewingDifferences ? (
          <Button
            key="confirm"
            type="primary"
            loading={confirmLoading}
            disabled={!selectedProjectId}
            onClick={async () => {
              if (!selectedProjectId || !differences) return;

              const hasMissingColumns =
                differences.missingDefaultColumns.length > 0 ||
                differences.missingCustomColumns.length > 0;

              await onConfirm(
                selectedProjectId,
                hasMissingColumns ? includeDifferences : false,
                includeDependencies
              );
            }}
          >
            {t('copyToProject.copyTask', { defaultValue: 'Copy task' })}
          </Button>
        ) : (
          <Button
            key="confirm"
            type="primary"
            loading={checkingDifferences}
            disabled={!selectedProjectId || loading || error || !reviewingDifferences}
          >
            {checkingDifferences
              ? t('copyToProject.checking', { defaultValue: 'Checking differences...' })
              : t('copyToProject.copyTask', { defaultValue: 'Copy task' })}
          </Button>
        ),
      ]}
    >
      {taskTitle && (
        <Typography.Text type="secondary" className="mb-4 block">
          {taskTitle}
        </Typography.Text>
      )}

      {hasDependencies && (
        <Alert
          type="info"
          showIcon
          message={t('copyToProject.dependenciesInfo', {
            defaultValue: 'This task has dependencies. The dependent tasks will also be copied to the destination project.',
          })}
          className="mb-4"
        />
      )}

      {loading && (
        <div className="flex justify-center py-6">
          <Spin />
        </div>
      )}

      {!loading && error && (
        <Alert
          type="error"
          showIcon
          message={t('copyToProject.loadError', {
            defaultValue: 'Unable to load accessible projects.',
          })}
        />
      )}

      {!loading && !error && projects.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('copyToProject.noProjects', {
            defaultValue: 'No other accessible projects found.',
          })}
        />
      )}

      {!loading && !error && projects.length > 0 && (
        <Select
          className="w-full"
          showSearch
          allowClear
          placeholder={t('copyToProject.selectProject', {
            defaultValue: 'Select a destination project',
          })}
          options={projectOptions}
          value={selectedProjectId}
          onChange={handleProjectSelect}
          optionFilterProp="searchLabel"
          filterOption={(input, option) =>
            (option?.searchLabel || '').toLowerCase().includes(input.toLowerCase())
          }
        />
      )}

      {!loading && !error && projects.length > 0 && hasDependencies && !reviewingDifferences && (
        <div className="space-y-2 border-t border-gray-200 pt-4 mt-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Typography.Text>
              {t('copyToProject.copyDependencies', {
                defaultValue: 'Copy dependency tasks',
              })}
            </Typography.Text>
            <Switch
              checked={includeDependencies}
              onChange={setIncludeDependencies}
            />
          </div>
          <Typography.Text type="secondary" className="text-xs">
            {t('copyToProject.copyDependenciesDescription', {
              defaultValue: 'Include all dependent tasks when copying this task to the destination project.',
            })}
          </Typography.Text>
        </div>
      )}

      {!loading && !error && reviewingDifferences && differences && (
        <div className="space-y-4">
          {differences.statusMapping?.isMissing &&
            differences.statusMapping.sourceStatusName &&
            differences.statusMapping.destinationStatusName && (
              <Alert
                type="info"
                showIcon
                message={t('copyToProject.statusMissing', {
                  defaultValue:
                    'Status "{{sourceStatus}}" is not in the destination project. The task will be assigned to the main "{{destinationStatus}}" status.',
                  sourceStatus: differences.statusMapping.sourceStatusName,
                  destinationStatus: differences.statusMapping.destinationStatusName,
                })}
              />
            )}

          {(differences.missingDefaultColumns.length > 0 ||
          differences.missingCustomColumns.length > 0 ||
          differences.missingPhases.length > 0) ? (
            <>
              {(differences.missingDefaultColumns.length > 0 ||
                differences.missingCustomColumns.length > 0) && (
                <Alert
                  type="warning"
                  showIcon
                  message={t('copyToProject.differencesFound', {
                    defaultValue: 'These columns are missing from the destination project.',
                  })}
                />
              )}
              {differences.missingPhases.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  message={t('copyToProject.missingPhasesFound', {
                    defaultValue: 'These phases will be created in the destination project.',
                  })}
                />
              )}
              {differences.missingPhases.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border border-solid border-gray-200 p-3 dark:border-gray-700">
                  {differences.missingPhases.map(phase => (
                    <div key={phase.id} className="py-1 text-sm">
                      {phase.name}
                    </div>
                  ))}
                </div>
              )}
              {(differences.missingDefaultColumns.length > 0 ||
                differences.missingCustomColumns.length > 0) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Typography.Text>
                      {t('copyToProject.createMissingColumns', {
                        defaultValue: 'Create missing columns',
                      })}
                    </Typography.Text>
                    <Switch
                      checked={includeDifferences}
                      onChange={setIncludeDifferences}
                    />
                  </div>
                  {includeDifferences && (
                    <div className="max-h-56 overflow-y-auto rounded border border-solid border-gray-200 p-3 dark:border-gray-700">
                      {[...differences.missingDefaultColumns, ...differences.missingCustomColumns].map(column => (
                        <div key={column.key} className="py-1 text-sm">
                          {column.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            !differences.statusMapping?.isMissing && (
              <Alert
                type="success"
                showIcon
                message={t('copyToProject.noDifferencesFound', {
                  defaultValue: 'The destination project has all required columns and phases.',
                })}
              />
            )
          )}

          {hasDependencies && (
            <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <Typography.Text>
                  {t('copyToProject.copyDependencies', {
                    defaultValue: 'Copy dependency tasks',
                  })}
                </Typography.Text>
                <Switch
                  checked={includeDependencies}
                  onChange={setIncludeDependencies}
                />
              </div>
              <Typography.Text type="secondary" className="text-xs">
                {t('copyToProject.copyDependenciesDescription', {
                  defaultValue: 'Include all dependent tasks when copying this task to the destination project.',
                })}
              </Typography.Text>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default CopyTaskToProjectModal;