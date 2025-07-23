import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import debounce from 'lodash/debounce';
import { useSearchParams } from 'react-router-dom';

import { InputRef } from 'antd/es/input';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import Space from 'antd/es/space';
import Dropdown from 'antd/es/dropdown';

import { setSearch } from '@/features/tasks/tasks.slice';
import { SearchOutlined } from '@/shared/antd-imports';

import { setBoardSearch } from '@/features/board/board-slice';

const SearchDropdown = () => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useDispatch();
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<InputRef>(null);
  const [searchParams] = useSearchParams();

  const tab = searchParams.get('tab');
  const projectView = tab === 'tasks-list' ? 'list' : 'kanban';

  // Debounced search dispatch
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      if (projectView === 'list') {
        dispatch(setSearch(value));
      } else {
        dispatch(setBoardSearch(value));
      }
    }, 300),
    [dispatch, projectView]
  );

  const handleSearch = useCallback(() => {
    debouncedSearch(searchValue);
  }, [searchValue, debouncedSearch]);

  const handleReset = useCallback(() => {
    setSearchValue('');
    if (projectView === 'list') {
      dispatch(setSearch(''));
    } else {
      dispatch(setBoardSearch(''));
    }
  }, [dispatch, projectView]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  }, []);

  // Memoized dropdown content
  const searchDropdownContent = useMemo(
    () => (
      <Card className="custom-card" styles={{ body: { padding: 8, width: 360 } }}>
        <Flex vertical gap={8}>
          <Input
            ref={searchInputRef}
            value={searchValue}
            onChange={handleSearchChange}
            placeholder={t('searchInputPlaceholder')}
          />
          <Space>
            <Button type="primary" onClick={handleSearch}>
              {t('searchButton')}
            </Button>
            <Button onClick={handleReset}>{t('resetButton')}</Button>
          </Space>
        </Flex>
      </Card>
    ),
    [searchValue, handleSearch, handleReset, handleSearchChange, t]
  );

  const handleSearchDropdownOpen = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, []);

  return (
    <Dropdown
      open={isOpen}
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => searchDropdownContent}
      onOpenChange={handleSearchDropdownOpen}
    >
      <Button icon={<SearchOutlined />} />
    </Dropdown>
  );
};

export default React.memo(SearchDropdown);
