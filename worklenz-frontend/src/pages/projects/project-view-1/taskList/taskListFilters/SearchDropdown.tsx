import { SearchOutlined } from '@/shared/antd-imports';
import { Button, Card, Dropdown, Flex, Input, InputRef, Space } from '@/shared/antd-imports';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

const SearchDropdown = () => {
  // localization
  const { t } = useTranslation('task-list-filters');

  const searchInputRef = useRef<InputRef>(null);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
  };

  // custom dropdown content
  const searchDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 360 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={searchInputRef}
          placeholder={t('searchInputPlaceholder')}
          onChange={handleSearchInputChange}
        />
        <Space>
          <Button type="primary">{t('searchButton')}</Button>
          <Button>{t('resetButton')}</Button>
        </Space>
      </Flex>
    </Card>
  );

  // function to focus search input
  const handleSearchDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => searchDropdownContent}
      onOpenChange={handleSearchDropdownOpen}
    >
      <Button icon={<SearchOutlined />} />
    </Dropdown>
  );
};

export default SearchDropdown;
