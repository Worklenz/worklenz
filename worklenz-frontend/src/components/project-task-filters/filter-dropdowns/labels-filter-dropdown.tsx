import {
  CaretDownFilled,
  Card,
  Flex,
  Input,
  List,
  Checkbox,
  Dropdown,
  Button,
  Empty,
  Space,
  InputRef,
} from '@/shared/antd-imports';
import { useSearchParams } from 'react-router-dom';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { fetchLabelsByProject, fetchTaskGroups, setLabels } from '@/features/tasks/tasks.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setBoardLabels } from '@/features/board/board-slice';
import { fetchBoardTaskGroups } from '@/features/board/board-slice';

const LabelsFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-filters');
  const [searchParams] = useSearchParams();
  const labelInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { labels, loadingLabels } = useAppSelector(state => state.taskReducer);
  const { labels: boardLabels, loadingLabels: boardLoadingLabels } = useAppSelector(
    state => state.boardReducer
  );
  const { projectId } = useAppSelector(state => state.projectReducer);

  const tab = searchParams.get('tab');
  const projectView = tab === 'tasks-list' ? 'list' : 'kanban';

  // Fetch labels when component mounts or projectId changes
  useEffect(() => {
    if (projectId) {
      dispatch(fetchLabelsByProject(projectId));
    }
  }, [dispatch, projectId]);

  const filteredLabelData = useMemo(() => {
    if (projectView === 'list') {
      return labels.filter(label => label.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    } else {
      return boardLabels.filter(label =>
        label.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  }, [labels, boardLabels, searchQuery, projectView]);

  const labelsCount = useMemo(() => {
    if (projectView === 'list') {
      return labels.filter(label => label.selected).length;
    } else {
      return boardLabels.filter(label => label.selected).length;
    }
  }, [labels, boardLabels, projectView]);

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // handle selected filters count
  const handleLabelSelect = (checked: boolean, labelId: string) => {
    if (projectView === 'list') {
      dispatch(
        setLabels(
          labels.map(label => (label.id === labelId ? { ...label, selected: checked } : label))
        )
      );
      if (projectId) dispatch(fetchTaskGroups(projectId));
    } else {
      dispatch(
        setBoardLabels(
          boardLabels.map(label => (label.id === labelId ? { ...label, selected: checked } : label))
        )
      );
      if (projectId) dispatch(fetchBoardTaskGroups(projectId));
    }
  };

  // function to focus labels input
  const handleLabelsDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 0);
    }
  };

  // custom dropdown content
  const labelsDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 260 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder')}
        />

        <List style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}>
          {filteredLabelData.length ? (
            filteredLabelData.map(label => (
              <List.Item
                className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                key={label.id}
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 8,
                  padding: '4px 8px',
                  border: 'none',
                }}
              >
                <Checkbox
                  id={label.id}
                  checked={label.selected}
                  onChange={e => handleLabelSelect(e.target.checked, label.id || '')}
                >
                  <Flex gap={8}>
                    <Badge color={label.color_code} />
                    {label.name}
                  </Flex>
                </Checkbox>
              </List.Item>
            ))
          ) : (
            <Empty />
          )}
        </List>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => labelsDropdownContent}
      onOpenChange={handleLabelsDropdownOpen}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        loading={loadingLabels}
        style={{
          backgroundColor:
            labelsCount > 0
              ? themeMode === 'dark'
                ? '#003a5c'
                : colors.paleBlue
              : colors.transparent,

          color: labelsCount > 0 ? (themeMode === 'dark' ? 'white' : colors.darkGray) : 'inherit',
        }}
      >
        <Space>
          {t('labelsText')}
          {labelsCount > 0 && <Badge size="small" count={labelsCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default LabelsFilterDropdown;
