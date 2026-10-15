import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CaretDownFilled,
  CheckCircleFilled,
  Checkbox,
  Divider,
  Dropdown,
  Empty,
  Input,
  Space,
  theme,
} from '@/shared/antd-imports';

export interface MembersTeamFilterOption {
  value: string;
  label: string;
}

interface MembersTeamFilterDropdownProps {
  options: MembersTeamFilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  loading?: boolean;
}

export const MembersTeamFilterDropdown = ({
  options,
  value,
  onChange,
  loading = false,
}: MembersTeamFilterDropdownProps) => {
  const { t } = useTranslation('reporting-members');
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState('');

  const filteredOptions = useMemo(
    () => options.filter(option => option.label.toLowerCase().includes(searchText.toLowerCase())),
    [options, searchText]
  );

  const isAllSelected = options.length > 0 && options.every(option => value.includes(option.value));
  const isNoneSelected = value.length === 0;

  const buttonLabel = isNoneSelected || isAllSelected
    ? t('allTeams', { defaultValue: 'All Teams' })
    : t('teamsSelectedCount', { count: value.length, defaultValue: 'Teams ({{count}})' });

  const handleToggle = (id: string, checked: boolean) => {
    onChange(checked ? [...value, id] : value.filter(selectedId => selectedId !== id));
  };

  return (
    <Dropdown
      placement="bottomLeft"
      trigger={['click']}
      onOpenChange={open => {
        if (!open) setSearchText('');
      }}
      popupRender={() => (
        <div
          className="flex flex-col"
          style={{
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
            padding: '4px 0',
            maxHeight: 330,
            minWidth: 240,
          }}
        >
          <div
            style={{
              padding: '4px 12px 6px',
              fontWeight: 600,
              fontSize: 12,
              color: token.colorTextSecondary,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {t('searchByName', { defaultValue: 'Search by name' })}
          </div>

          <div style={{ padding: '8px 12px 4px', flexShrink: 0 }}>
            <Input
              allowClear
              value={searchText}
              placeholder={t('searchByName', { defaultValue: 'Search by name' })}
              aria-label={t('searchByName', { defaultValue: 'Search by name' })}
              onChange={event => setSearchText(event.target.value)}
              onClick={event => event.stopPropagation()}
            />
          </div>

          <div style={{ padding: '2px 12px' }}>
            <Space size="small">
              <Button
                type="link"
                size="small"
                disabled={isAllSelected}
                onClick={() => onChange(options.map(option => option.value))}
                style={{ padding: '0 2px', height: 'auto', fontSize: 11 }}
              >
                {t('selectAll', { defaultValue: 'Select All' })}
              </Button>
              <Divider type="vertical" style={{ margin: '0 2px' }} />
              <Button
                type="link"
                size="small"
                danger
                disabled={isNoneSelected}
                onClick={() => onChange([])}
                style={{ padding: '0 2px', height: 'auto', fontSize: 11 }}
              >
                {t('clearAll', { defaultValue: 'Clear All' })}
              </Button>
            </Space>
          </div>

          <Divider style={{ margin: '2px 0', flexShrink: 0 }} />

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('noTeamsFound', { defaultValue: 'No teams found' })}
              />
            ) : (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className="flex items-center gap-2"
                    style={{ padding: '4px 12px' }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onClick={event => event.stopPropagation()}
                      onChange={event => handleToggle(option.value, event.target.checked)}
                    >
                      {option.label}
                    </Checkbox>
                    {isSelected && (
                      <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 10 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    >
      <Button icon={<CaretDownFilled />} iconPosition="end" loading={loading}>
        {buttonLabel}
      </Button>
    </Dropdown>
  );
};
