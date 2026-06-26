import { memo, useState, useEffect, useMemo } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  Typography,
  Spin,
} from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPhases = async () => {
      if (selectedProjects.length === 0) {
        setPhases([]);
        return;
      }

      setLoading(true);
      try {
        const responses = await Promise.all(
          selectedProjects.map(projectId =>
            phasesApiService.getPhasesByProjectId(projectId)
          )
        );

        // Merge and deduplicate by id
        const seen = new Set<string>();
        const merged: ITaskPhase[] = [];

        responses.forEach(response => {
          if (response.done && response.body) {
            response.body.forEach((phase: ITaskPhase) => {
              if (phase.id && !seen.has(phase.id)) {
                seen.add(phase.id);
                merged.push(phase);
              }
            });
          }
        });

        setPhases(merged);
      } catch (error) {
        console.error('Error fetching phases:', error);
        setPhases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPhases();
  }, [selectedProjects]);

  // Clear selected phases that no longer exist when projects change
  useEffect(() => {
    if (phases.length === 0 && selectedPhases.length > 0) {
      dispatch(setSelectedPhases([]));
      return;
    }
    const availableIds = new Set(phases.map(p => p.id));
    const invalid = selectedPhases.filter(id => !availableIds.has(id));
    if (invalid.length > 0) {
      dispatch(setSelectedPhases(selectedPhases.filter(id => availableIds.has(id))));
    }
  }, [phases]);

  const filteredPhases = phases.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (phaseId: string) => {
    const updated = selectedPhases.includes(phaseId)
      ? selectedPhases.filter(id => id !== phaseId)
      : [...selectedPhases, phaseId];
    dispatch(setSelectedPhases(updated));
    dispatch(fetchAllTasks());
  };

  const handleClearAll = () => {
    dispatch(setSelectedPhases([]));
    dispatch(fetchAllTasks());
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 280 } }}>
      <Flex vertical gap={8}>
        <Input
          placeholder={t('searchPhases', { defaultValue: 'Search phases...' })}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
        />
        <Flex justify="flex-end">
          <Button type="link" size="small" onClick={handleClearAll}>
            {t('clearAll', { defaultValue: 'Clear All' })}
          </Button>
        </Flex>

        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : filteredPhases.length === 0 ? (
          <Typography.Text type="secondary" style={{ padding: '4px 8px', fontSize: 12 }}>
            {selectedProjects.length === 0
              ? t('selectProjectFirst', { defaultValue: 'Select a project to see phases' })
              : t('noPhases', { defaultValue: 'No phases found' })}
          </Typography.Text>
        ) : (
          <Flex vertical gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredPhases.map(phase => (
              <Checkbox
                key={phase.id}
                checked={selectedPhases.includes(phase.id || '')}
                onChange={() => handleToggle(phase.id || '')}
              >
                <Flex align="center" gap={8}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: phase.color_code || '#1890ff',
                    }}
                  />
                  {phase.name}
                </Flex>
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