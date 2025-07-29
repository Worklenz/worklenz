import { CaretDownFilled } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputRef,
  List,
  Space,
} from '@/shared/antd-imports';
import { useEffect, useRef, useState } from 'react';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { useAppSelector } from '@/hooks/useAppSelector';

const LabelsFilterDropdown = (props: { labels: ITaskLabel[] }) => {
  const { t } = useTranslation('task-list-filters');
  const labelInputRef = useRef<InputRef>(null);
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [filteredLabelList, setFilteredLabelList] = useState<ITaskLabel[]>(props.labels);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    setFilteredLabelList(props.labels);
  }, [props.labels]);

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // handle selected filters count
  const handleSelectedFiltersCount = (checked: boolean) => {
    setSelectedCount(prev => (checked ? prev + 1 : prev - 1));
  };

  // function to focus labels input
  const handleLabelsDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 0);
    }
  };

  const handleSearchQuery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchText = e.currentTarget.value;
    setSearchQuery(searchText);
    if (searchText.length === 0) {
      setFilteredLabelList(props.labels);
      return;
    }
    setFilteredLabelList(
      props.labels.filter(label => label.name?.toLowerCase().includes(searchText.toLowerCase()))
    );
  };

  // custom dropdown content
  const labelsDropdownContent = (
    <Card
      className="custom-card"
      styles={{
        body: { padding: 8, width: 260, maxHeight: 250, overflow: 'hidden', overflowY: 'auto' },
      }}
    >
      <Flex vertical gap={8}>
        <Input
          ref={labelInputRef}
          value={searchQuery}
          onChange={e => handleSearchQuery(e)}
          placeholder={t('searchInputPlaceholder')}
        />

        <List style={{ padding: 0 }}>
          {filteredLabelList.length ? (
            filteredLabelList.map(label => (
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
                  onChange={e => handleSelectedFiltersCount(e.target.checked)}
                />

                <Flex gap={8}>
                  <Badge color={label.color_code} />
                  {label.name}
                </Flex>
              </List.Item>
            ))
          ) : (
            <Empty description={t('noLabelsFound')} />
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
        style={{
          backgroundColor: selectedCount > 0 ? colors.paleBlue : colors.transparent,

          color: selectedCount > 0 ? colors.darkGray : 'inherit',
        }}
      >
        <Space>
          {t('labelsText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default LabelsFilterDropdown;
