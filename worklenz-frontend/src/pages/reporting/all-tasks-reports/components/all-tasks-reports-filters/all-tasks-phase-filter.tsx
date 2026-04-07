import { memo, useEffect, useState, useCallback } from 'react';
import { Button, Card, Checkbox, Dropdown, Flex, Typography, Tag, Spin } from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import {
  setSelectedPhases,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksPhaseFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { selectedPhases, selectedProjects } = useAppSelector(
    state => state.allTasksReportsReducer
  );

  const [phases, setPhases] = useState<ITaskPhase[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch phases for all selected projects, deduplicated by name
  useEffect(() => {
    const fetchPhases = async () => {
      if (!selectedProjects.length) {
        setPhases([]);
        return;
      }

      setLoading(true);
      try {
        const results = await Promise.all(
          selectedProjects.map(projectId =>
            phasesApiService.getPhasesByProjectId(projectId).then((res: { body: any; }) => res.body || [])
          )
        );

        // Merge and deduplicate by name (case-insensitive)
        const seen = new Set<string>();
        const merged: ITaskPhase[] = [];
        for (const phaseList of results) {
          for (const phase of phaseList) {
            const key = phase.name?.toLowerCase() ?? '';
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(phase);
            }
          }
        }
        setPhases(merged);
      } catch (e) {
        console.error('Failed to fetch phases', e);
      } finally {
        setLoading(false);
      }
    };

    fetchPhases();
  }, [selectedProjects]);

  const handleToggle = useCallback(
    (phaseId: string) => {
      const updated = selectedPhases.includes(phaseId)
        ? selectedPhases.filter(id => id !== phaseId)
        : [...selectedPhases, phaseId];
      dispatch(setSelectedPhases(updated));
      dispatch(fetchAllTasks());
    },
    [dispatch, selectedPhases]
  );

  const handleClearAll = useCallback(() => {
    dispatch(setSelectedPhases([]));
    dispatch(fetchAllTasks());
  }, [dispatch]);

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 220 } }}>
      <Flex vertical gap={8}>
        <Flex justify="flex-end">
          <Button type="link" size="small" onClick={handleClearAll}>
            {t('clearAll', { defaultValue: 'Clear All' })}
          </Button>
        </Flex>

        {loading ? (
          <Flex justify="center" style={{ padding: 12 }}>
            <Spin size="small" />
          </Flex>
        ) : phases.length === 0 ? (
          <Typography.Text type="secondary" style={{ padding: '4px 8px', fontSize: 12 }}>
            {selectedProjects.length === 0
              ? t('selectProjectFirst', { defaultValue: 'Select a project to see phases' })
              : t('noPhases', { defaultValue: 'No phases found' })}
          </Typography.Text>
        ) : (
          <Flex vertical gap={4}>
            {phases.map(phase => (
              <Checkbox
                key={phase.id}
                checked={selectedPhases.includes(phase.id || '')}
                onChange={() => handleToggle(phase.id || '')}
              >
                <Tag color={phase.color_code} style={{ margin: 0 }}>
                  {phase.name}
                </Tag>
              </Checkbox>
            ))}
          </Flex>
        )}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t('phaseFilter', { defaultValue: 'Phase' })}
          {selectedPhases.length > 0 && (
            <Typography.Text type="secondary">({selectedPhases.length})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksPhaseFilter);