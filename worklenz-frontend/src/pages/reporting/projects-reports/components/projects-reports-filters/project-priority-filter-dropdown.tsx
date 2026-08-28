import { memo, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  List,
  Tag,
  theme,
} from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';
import {
  setSelectedProjectPriorities,
  toggleProjectPriority,
  fetchProjectDataForCurrentView,
} from '@/features/reporting/projectReports/project-reports-slice';

const NO_PRIORITY_ID = '__no_priority__';

const ProjectPriorityFilterDropdown = () => {
  const { t } = useTranslation('reporting-projects-filters');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);
  const { selectedProjectPriorities } = useAppSelector(state => state.projectReportsReducer);
  const { priorities, loading: prioritiesLoading } = useAppSelector(
    state => state.projectPriorityReducer
  );

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (!priorities.length) {
      dispatch(fetchProjectPriorities());
    }
  }, [dispatch, priorities.length]);

  const handleToggle = (priorityId: string) => {
    dispatch(toggleProjectPriority(priorityId));
    dispatch(fetchProjectDataForCurrentView());
  };

  const handleClearAll = () => {
    dispatch(setSelectedProjectPriorities([]));
    dispatch(fetchProjectDataForCurrentView());
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 220 } }}>
      <Flex vertical gap={8}>
        <List
          style={{ padding: 0, maxHeight: 220, overflowY: 'auto' }}
          loading={prioritiesLoading}
        >
          {/* No priority option */}
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={NO_PRIORITY_ID}
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
            }}
          >
            <Checkbox
              checked={selectedProjectPriorities.includes(NO_PRIORITY_ID)}
              onChange={() => handleToggle(NO_PRIORITY_ID)}
            >
              <Tag
                style={{
                  margin: 0,
                  backgroundColor: token.colorFillSecondary,
                  color: token.colorTextSecondary,
                  borderColor: token.colorBorderSecondary,
                }}
              >
                {t('noPriority', { defaultValue: 'No priority' })}
              </Tag>
            </Checkbox>
          </List.Item>

          {priorities.map(priority => (
            <List.Item
              className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
              key={priority.id}
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                gap: 8,
                padding: '4px 8px',
                border: 'none',
              }}
            >
              <Checkbox
                checked={selectedProjectPriorities.includes(priority.id || '')}
                onChange={() => handleToggle(priority.id || '')}
              >
                <Tag color={priority.color_code} style={{ margin: 0 }}>
                  {priority.name}
                </Tag>
              </Checkbox>
            </List.Item>
          ))}
        </List>

        {selectedProjectPriorities.length > 0 && (
          <Flex justify="flex-end">
            <Button type="link" size="small" onClick={handleClearAll}>
              {t('clearAll', { defaultValue: 'Clear All' })}
            </Button>
          </Flex>
        )}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => dropdownContent}
      onOpenChange={open => setIsDropdownOpen(open)}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        loading={prioritiesLoading}
        style={
          isDropdownOpen
            ? { borderColor: token.colorPrimary, color: token.colorPrimary }
            : undefined
        }
        className="transition-colors duration-300"
      >
        {t('priorityText', { defaultValue: 'Priority' })}
        {selectedProjectPriorities.length > 0 && (
          <Badge
            count={selectedProjectPriorities.length}
            size="small"
            style={{ marginLeft: 4, backgroundColor: token.colorPrimary }}
          />
        )}
      </Button>
    </Dropdown>
  );
};

export default memo(ProjectPriorityFilterDropdown);
