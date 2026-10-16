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

const getLabelTextColor = (color?: string): string => {
  if (!color) return 'inherit';

  const hex = color.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
    return 'inherit';
  }

  const normalizedHex =
    hex.length === 3
      ? hex.split('').map(character => character + character).join('')
      : hex;

  const red = parseInt(normalizedHex.slice(0, 2), 16) / 255;
  const green = parseInt(normalizedHex.slice(2, 4), 16) / 255;
  const blue = parseInt(normalizedHex.slice(4, 6), 16) / 255;

  const luminance = [red, green, blue]
    .map(channel =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    )
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0
    );

  return luminance > 0.179 ? '#000000' : '#FFFFFF';
};

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

                <Tag
                  color={label.color_code}
                  style={{
                    margin: 0,
                    color: getLabelTextColor(label.color_code),
                  }}
                >
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
      popupRender={() => dropdownContent}
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
