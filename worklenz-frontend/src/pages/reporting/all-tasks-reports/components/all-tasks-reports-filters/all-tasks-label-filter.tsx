import { memo, useState, useEffect } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  Typography,
  Spin,
  Tag,
} from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import {
  setSelectedLabels,
  toggleLabel,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksLabelFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { selectedLabels } = useAppSelector(state => state.allTasksReportsReducer);

  const [labels, setLabels] = useState<ITaskLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchLabels = async () => {
      setLoading(true);

      try {
        const response = await labelsApiService.getLabels();

        if (response.done && response.body) {
          setLabels(response.body);
        } else {
          setLabels([]);
        }
      } catch (error) {
        console.error('Error fetching labels:', error);
        setLabels([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchLabels();
  }, []);

  const filteredLabels = labels.filter(label =>
    label.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (labelId: string) => {
    dispatch(toggleLabel(labelId));
    dispatch(fetchAllTasks());
  };

  const handleClearAll = () => {
    dispatch(setSelectedLabels([]));
    dispatch(fetchAllTasks());
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 280 } }}>
      <Flex vertical gap={8}>
        <Input
          placeholder={t('searchLabels', { defaultValue: 'Search labels...' })}
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
        ) : filteredLabels.length === 0 ? (
          <Typography.Text type="secondary" style={{ padding: '4px 8px', fontSize: 12 }}>
            {t('noLabels', { defaultValue: 'No labels found' })}
          </Typography.Text>
        ) : (
          <Flex vertical gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredLabels.map(label => (
              <Checkbox
                key={label.id}
                checked={selectedLabels.includes(label.id || '')}
                onChange={() => handleToggle(label.id || '')}
              >
                <Tag color={label.color_code} style={{ margin: 0 }}>
                  {label.name}
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
          {t('labelFilter', { defaultValue: 'Labels' })}
          {selectedLabels.length > 0 && (
            <Typography.Text type="secondary">({selectedLabels.length})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksLabelFilter);
