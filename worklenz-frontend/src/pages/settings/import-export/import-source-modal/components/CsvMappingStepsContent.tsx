import React from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import {
  Card,
  Checkbox,
  Collapse,
  InboxOutlined,
  Input,
  PlusOutlined,
  Select,
  Switch,
  TableOutlined,
  Typography,
  UserAddOutlined,
  UserOutlined,
} from '@/shared/antd-imports';

const MOVE_USERS_ROW_HEIGHT = 52;
const MOVE_USERS_MAX_LIST_HEIGHT = 420;
const CREATE_CUSTOM_FIELD_PREFIX = '__create_custom__:';

const toCustomFieldKey = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized ? normalized : 'custom_field';
};

interface WorkTypeOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  level: number;
}

interface MoveUserListData {
  users: string[];
  userEmails: Record<string, string>;
  setUserEmails: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  palette: {
    text: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    inputBg: string;
    rowBg: string;
    border: string;
    infoBg: string;
    infoBorder: string;
    success: string;
  };
}

interface CsvMappingStepsContentProps {
  step: number;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  themeToken: any;
  csvColumns: string[];
  fieldMappings: Record<string, string>;
  setFieldMappings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  includeInImport: Record<string, boolean>;
  setIncludeInImport: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  worklenzFieldOptions: Array<{ value: string; label: string }>;
  statusValues: string[];
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  statusColumnKey?: string;
  statusOptions: WorkTypeOption[];
  statusValueMapping: Record<string, string>;
  setStatusValueMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  csvUserRows: string[];
  userEmails: Record<string, string>;
  setUserEmails: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addUsers: boolean;
  setAddUsers: React.Dispatch<React.SetStateAction<boolean>>;
}

const MoveUsersRow = ({ index, style, data }: ListChildComponentProps<MoveUserListData>) => {
  const user = data.users[index];

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        background: data.palette.rowBg,
        borderRadius: 6,
        marginBottom: 4,
        minHeight: 44,
        paddingRight: 8,
      }}
    >
      <span
        style={{
          flex: 2,
          paddingLeft: 8,
          color: data.palette.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {user}
      </span>
      <span style={{ width: 40, textAlign: 'center', color: data.palette.primary, fontSize: 20 }}>
        &rarr;
      </span>
      <span style={{ flex: 3 }}>
        <Input
          placeholder={data.t('importStep.enterEmail', { defaultValue: 'Enter email' })}
          value={data.userEmails[user] || ''}
          onChange={e => data.setUserEmails(emails => ({ ...emails, [user]: e.target.value }))}
          style={{
            width: '100%',
            background: data.palette.inputBg,
            color: data.palette.text,
            border: `1px solid ${data.palette.border}`,
          }}
        />
      </span>
    </div>
  );
};

export const CsvMappingStepsContent: React.FC<CsvMappingStepsContentProps> = ({
  step,
  t,
  themeToken,
  csvColumns,
  fieldMappings,
  setFieldMappings,
  includeInImport,
  setIncludeInImport,
  worklenzFieldOptions,
  statusValues,
  searchValue,
  setSearchValue,
  filter,
  setFilter,
  statusColumnKey,
  statusOptions,
  statusValueMapping,
  setStatusValueMapping,
  csvUserRows,
  userEmails,
  setUserEmails,
  addUsers,
  setAddUsers,
}) => {
  const browserLocale = React.useMemo(() => {
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
    return 'en-US';
  }, []);

  const browserTimezone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (error) {
      return 'UTC';
    }
  }, []);

  const timezoneOptions = React.useMemo(() => {
    const common = ['UTC', 'Asia/Colombo', 'America/New_York', 'Europe/London'];
    const all = Array.from(new Set([browserTimezone, ...common]));
    return all.map(zone => ({ value: zone, label: zone }));
  }, [browserTimezone]);

  const palette = React.useMemo(
    () => ({
      text: themeToken.colorText,
      textSecondary: themeToken.colorTextSecondary,
      textMuted: themeToken.colorTextTertiary || themeToken.colorTextSecondary,
      primary: themeToken.colorPrimary,
      inputBg: themeToken.colorBgContainer,
      rowBg: themeToken.colorBgElevated,
      border: themeToken.colorBorder,
      infoBg: themeToken.colorInfoBg || themeToken.colorBgElevated,
      infoBorder: themeToken.colorInfoBorder || themeToken.colorBorder,
      success: themeToken.colorSuccess || '#22c55e',
    }),
    [themeToken]
  );

  const fieldLabelByValue = React.useMemo(() => {
    const map = new Map<string, string>();
    worklenzFieldOptions.forEach(option => {
      map.set(option.value, option.label);
    });
    return map;
  }, [worklenzFieldOptions]);

  const knownTargetKeys = React.useMemo(() => {
    const known = new Set<string>();
    worklenzFieldOptions.forEach(option => {
      known.add(option.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
      known.add(option.label.toLowerCase().replace(/[^a-z0-9]/g, ''));
    });
    return known;
  }, [worklenzFieldOptions]);

  const buildMappingOptions = React.useCallback(
    (columnName: string) => {
      const createLabel = t('importStep.createCustomFieldFromColumn', {
        defaultValue: 'Create custom field "{{column}}"',
        column: columnName,
      });

      return [
        ...worklenzFieldOptions.map(option => ({
          value: option.value,
          label: option.label,
        })),
        {
          value: `${CREATE_CUSTOM_FIELD_PREFIX}${columnName}`,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <PlusOutlined />
              {createLabel}
            </span>
          ),
          searchLabel: createLabel.toLowerCase(),
        },
      ];
    },
    [t, worklenzFieldOptions]
  );

  const filteredColumns = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return csvColumns.filter(columnName => {
      const matchesSearch =
        normalizedSearch.length === 0 || columnName.toLowerCase().includes(normalizedSearch);

      const isMapped = !!fieldMappings[columnName];
      const matchesFilter =
        filter === 'all' || (filter === 'mapped' ? isMapped : !isMapped);

      return matchesSearch && matchesFilter;
    });
  }, [csvColumns, fieldMappings, filter, searchValue]);

  if (step === 2) {
    return (
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ color: palette.text, marginBottom: 8 }}>
          {t('importStep.mapSpaceFields', { defaultValue: '' })}
        </Typography.Title>
        <Typography.Paragraph style={{ color: palette.textSecondary, marginBottom: 16 }}>
          {t('importStep.mapFieldsDescription', { defaultValue: '' })}
        </Typography.Paragraph>

        <Collapse ghost style={{ marginBottom: 16 }} bordered={false} expandIconPosition="start">
          <Collapse.Panel
            header={
              <span style={{ color: palette.primary, fontSize: 15 }}>
                &gt; Date and time parsing options (optional)
              </span>
            }
            key="dateTimeFormat"
            style={{ background: 'transparent', border: 'none', padding: 0 }}
          >
            <Typography.Paragraph style={{ color: palette.textSecondary, marginBottom: 8 }}>
              {t('importStep.dateParsingOptional', {
                defaultValue:
                  'Use these only if imported dates look incorrect. By default, we try to infer values from your CSV and browser settings.',
              })}
            </Typography.Paragraph>
            <div style={{ display: 'flex', gap: 24, marginBottom: 8, marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Typography.Text style={{ color: palette.text, fontWeight: 500, marginBottom: 2 }}>
                  {t('importStep.dateTimeFormatOptional', {
                    defaultValue: 'Date and time format (optional)',
                  })}
                </Typography.Text>
                <Input
                  placeholder={t('importStep.dateTimeFormatPlaceholder', {
                    defaultValue: 'Auto-detect (e.g. dd/MMM/yy h:mm a)',
                  })}
                  style={{
                    width: '100%',
                    background: palette.inputBg,
                    color: palette.text,
                    border: `1px solid ${palette.border}`,
                  }}
                />
                <Typography.Text style={{ color: palette.textMuted, fontSize: 12 }}>
                  e.g. dd/MMM/yy h:mm a
                </Typography.Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Typography.Text style={{ color: palette.text, fontWeight: 500, marginBottom: 2 }}>
                  {t('importStep.localeOptional', { defaultValue: 'Locale (optional)' })}
                </Typography.Text>
                <Select defaultValue={browserLocale} style={{ width: '100%' }}>
                  <Select.Option value={browserLocale}>
                    {t('importStep.detectedLocale', {
                      defaultValue: '{{locale}} (detected)',
                      locale: browserLocale,
                    })}
                  </Select.Option>
                  <Select.Option value="en-US">English (US)</Select.Option>
                  <Select.Option value="fr">French (FR)</Select.Option>
                  <Select.Option value="de">German (DE)</Select.Option>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Typography.Text style={{ color: palette.text, fontWeight: 500, marginBottom: 2 }}>
                  {t('importStep.timezoneOptional', { defaultValue: 'Timezone (optional)' })}
                </Typography.Text>
                <Select defaultValue={browserTimezone} style={{ width: '100%' }}>
                  {timezoneOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>
          </Collapse.Panel>
        </Collapse>

        <Typography.Text style={{ color: palette.textSecondary, display: 'block', marginBottom: 12 }}>
          {t('importStep.customColumnHint', {
            defaultValue:
              'Need a custom column? Type a new name in the Worklenz field box while mapping.',
          })}
        </Typography.Text>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <Input
            placeholder={t('importStep.searchCsvColumns', {
              defaultValue: 'Search columns in CSV',
            })}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            style={{
              width: 260,
              background: palette.inputBg,
              color: palette.text,
              border: `1px solid ${palette.border}`,
            }}
          />
          <Select value={filter} onChange={setFilter} style={{ width: 120 }}>
            <Select.Option value="all">
              {t('importStep.fieldsFilterAll', { defaultValue: 'Fields: All' })}
            </Select.Option>
            <Select.Option value="mapped">{t('common.mapped', { defaultValue: 'Mapped' })}</Select.Option>
            <Select.Option value="unmapped">
              {t('common.unmapped', { defaultValue: 'Unmapped' })}
            </Select.Option>
          </Select>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginTop: 16,
            maxHeight: 420,
            overflowY: 'auto',
            overflowX: 'auto',
            paddingRight: 6,
            paddingBottom: 12,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              color: palette.textSecondary,
              fontWeight: 500,
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            <span style={{ flex: 2, paddingLeft: 8 }}>Columns in CSV</span>
            <span style={{ flex: 2 }}>
              {t('importStep.worklenzFields', { defaultValue: 'Worklenz fields' })}
            </span>
            <span style={{ width: 140, textAlign: 'center' }}>
              {t('importStep.includeInImport', { defaultValue: 'Include in import' })}
            </span>
          </div>

          {csvColumns.length === 0 ? (
            <div style={{ color: palette.textMuted, margin: '24px 0' }}>
              {t('importStep.uploadCsvToMapFields', {
                defaultValue: 'Upload a CSV file to map fields.',
              })}
            </div>
          ) : filteredColumns.length === 0 ? (
            <div style={{ color: palette.textMuted, margin: '24px 0' }}>
              {t('importStep.noMatchingColumns', {
                defaultValue: 'No columns match your search or filter.',
              })}
            </div>
          ) : (
            filteredColumns.map(col => (
              <div
                key={col}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: palette.rowBg,
                  borderRadius: 6,
                  marginBottom: 4,
                  minHeight: 44,
                }}
              >
                <span style={{ flex: 2, paddingLeft: 8, color: palette.text }}>{col}</span>
                <span style={{ flex: 2 }}>
                  {(() => {
                    const storedValue = fieldMappings[col] || '';
                    const displayValue = fieldLabelByValue.get(storedValue) || storedValue;
                    const normalizedStored = storedValue.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const isCustomFieldCandidate =
                      !!normalizedStored && !knownTargetKeys.has(normalizedStored);
                    const mappingOptions = buildMappingOptions(col);
                    return (
                      <>
                        <Select
                          showSearch
                          placeholder={t('importStep.selectFieldToMap', {
                            defaultValue: 'Select a field to map',
                          })}
                          style={{ width: '100%' }}
                          value={storedValue || undefined}
                          optionFilterProp="searchLabel"
                          onChange={value => {
                            if ((value as string).startsWith(CREATE_CUSTOM_FIELD_PREFIX)) {
                              const customFieldName = (value as string).slice(CREATE_CUSTOM_FIELD_PREFIX.length).trim();
                              const normalizedCustomField = toCustomFieldKey(customFieldName);
                              setFieldMappings(m => ({ ...m, [col]: normalizedCustomField }));
                              setIncludeInImport(i => ({ ...i, [col]: true }));
                              return;
                            }
                            setFieldMappings(m => ({ ...m, [col]: value as string }));
                          }}
                          options={[
                            ...(storedValue && !mappingOptions.some(option => option.value === storedValue)
                              ? [{ value: storedValue, label: displayValue, searchLabel: displayValue.toLowerCase() }]
                              : []),
                            ...mappingOptions,
                          ]}
                          allowClear
                          filterOption={(inputValue, option) => {
                            const searchValue = String(option?.searchLabel || '').toLowerCase();
                            return searchValue.includes(inputValue.toLowerCase());
                          }}
                        />
                        {isCustomFieldCandidate && (
                          <Typography.Text
                            style={{
                              color: palette.primary,
                              fontSize: 12,
                              marginTop: 4,
                              display: 'inline-block',
                            }}
                          >
                            {t('importStep.customFieldWillBeCreated', {
                              defaultValue: 'Will create custom field',
                            })}
                          </Typography.Text>
                        )}
                      </>
                    );
                  })()}
                </span>
                <span style={{ width: 140, textAlign: 'center' }}>
                  <Checkbox
                    checked={includeInImport[col] !== false}
                    onChange={e => setIncludeInImport(i => ({ ...i, [col]: e.target.checked }))}
                  />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (step === 3) {
    const filteredValues = statusValues.filter(
      value =>
        value.toLowerCase().includes(searchValue.toLowerCase()) &&
        (filter === 'all' || (filter === 'mapped' ? statusValueMapping[value] : !statusValueMapping[value]))
    );

    const emptyValuesMessage = statusColumnKey
      ? t('importStep.noStatusValuesFound', 'No values found in the mapped Status column.')
      : t('importStep.selectStatusColumnPrompt', 'Map a CSV column to Status to see values.');

    return (
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ color: palette.text, marginBottom: 8 }}>
          {t('importStep.mapValues', 'Map values to statuses')}
        </Typography.Title>
        <Typography.Paragraph style={{ color: palette.textSecondary, marginBottom: 16 }}>
          {t(
            'importStep.mapValuesHelp',
            'Build more structure into your space by mapping values in your Status column to Worklenz statuses.'
          )}{' '}
          <a
            href="https://worklenz.com/blog/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: palette.primary }}
          >
            {t('importStep.mapValuesDocs', 'Read about mapping statuses')}
          </a>
        </Typography.Paragraph>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Input
            placeholder={t('importStep.searchValues', { defaultValue: 'Search values' })}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            style={{
              width: 220,
              background: palette.inputBg,
              color: palette.text,
              border: `1px solid ${palette.border}`,
            }}
          />
          <Select
            value={filter}
            onChange={setFilter}
            style={{ width: 120 }}
            styles={{ popup: { root: { background: palette.rowBg, color: palette.text } } }}
          >
            <Select.Option value="all">
              {t('importStep.valuesFilterAll', { defaultValue: 'Values: All' })}
            </Select.Option>
            <Select.Option value="mapped">{t('common.mapped', { defaultValue: 'Mapped' })}</Select.Option>
            <Select.Option value="unmapped">
              {t('common.unmapped', { defaultValue: 'Unmapped' })}
            </Select.Option>
          </Select>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: palette.textSecondary,
            fontWeight: 500,
            fontSize: 15,
            marginBottom: 8,
          }}
        >
          <span style={{ flex: 2, paddingLeft: 8 }}>
            <InboxOutlined style={{ marginRight: 8 }} />
            {t('importStep.valuesInSelectedColumn', {
              defaultValue: 'Values in the selected column',
            })}
          </span>
          <span style={{ flex: 1 }}></span>
          <span style={{ flex: 2, display: 'flex', alignItems: 'center' }}>
            <TableOutlined style={{ marginRight: 8, color: palette.primary }} />
            {t('importStep.worklenzWorkTypes', { defaultValue: 'Worklenz statuses' })}
          </span>
        </div>

        {filteredValues.length === 0 ? (
          <div style={{ color: palette.textMuted, margin: '24px 0' }}>{emptyValuesMessage}</div>
        ) : (
          filteredValues.map(value => (
            <div
              key={value}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: palette.inputBg,
                borderRadius: 8,
                marginBottom: 8,
                minHeight: 44,
              }}
            >
              <span style={{ flex: 2, paddingLeft: 8, color: palette.text, fontSize: 16 }}>
                {value}
              </span>
              <span style={{ flex: 1, textAlign: 'center', color: palette.textSecondary, fontSize: 20 }}>
                &rarr;
              </span>
              <span style={{ flex: 2 }}>
                <Select
                  value={statusValueMapping[value] || undefined}
                  onChange={val => setStatusValueMapping(m => ({ ...m, [value]: val }))}
                  placeholder={t('importStep.selectWorkType', {
                    defaultValue: 'Select status',
                  })}
                  style={{
                    width: '100%',
                    background: palette.rowBg,
                    color: palette.text,
                    border: `1px solid ${palette.border}`,
                  }}
                  styles={{ popup: { root: { background: palette.rowBg, color: palette.text } } }}
                  popupRender={menu => (
                    <>
                      <div
                        style={{
                          padding: '8px 12px',
                          color: palette.textSecondary,
                          fontWeight: 500,
                          fontSize: 13,
                        }}
                      >
                        MAP TO A SUGGESTED STATUS
                      </div>
                      {menu}
                      <div style={{ borderTop: `1px solid ${palette.border}`, margin: '8px 0' }} />
                      <div
                        style={{ padding: '8px 12px', color: palette.primary, cursor: 'pointer' }}
                        onClick={() => {
                          setStatusValueMapping(m => {
                            const copy = { ...m };
                            delete copy[value];
                            return copy;
                          });
                        }}
                      >
                        Clear selection
                      </div>
                    </>
                  )}
                  optionLabelProp="label"
                >
                  {statusOptions.map(wt => (
                    <Select.Option key={wt.key} value={wt.key} label={wt.label}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {wt.icon}
                        <span style={{ color: palette.text }}>{wt.label}</span>
                        <span style={{ color: palette.textSecondary, fontSize: 13, marginLeft: 8 }}>
                          {t('importStep.statusLevel', 'Level')} {wt.level}
                        </span>
                      </span>
                    </Select.Option>
                  ))}
                </Select>
              </span>
            </div>
          ))
        )}
      </div>
    );
  }

  if (step === 4) {
    const noUsers = csvUserRows.length === 0;
    const usersMovingCount = csvUserRows.filter(user => {
      const candidate = (userEmails[user] || '').trim();
      return addUsers && !!candidate && candidate.includes('@');
    }).length;
    const usersListHeight = Math.min(
      csvUserRows.length * MOVE_USERS_ROW_HEIGHT,
      MOVE_USERS_MAX_LIST_HEIGHT
    );
    const userListData: MoveUserListData = {
      users: csvUserRows,
      userEmails,
      setUserEmails,
      t,
      palette,
    };

    return (
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ color: palette.text, marginBottom: 16 }}>
          {t('importStep.moveUsersToWorklenz', { defaultValue: 'Move users to Worklenz' })}
        </Typography.Title>

        {noUsers ? (
          <Card
            style={{
              marginBottom: 24,
              maxWidth: 680,
              background: palette.infoBg,
              borderColor: palette.infoBorder,
            }}
          >
            <Typography.Title level={4} style={{ color: palette.text, marginBottom: 8 }}>
              {t('importStep.noUsersInCsvTitle', {
                defaultValue: 'There are no users in the CSV file',
              })}
            </Typography.Title>
            <Typography.Paragraph style={{ color: palette.textSecondary, marginBottom: 12 }}>
              {t('importStep.noUsersInCsvDescription', {
                defaultValue:
                  'You can proceed with import, or restart with a CSV that includes user data. If you proceed:',
              })}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ color: palette.text, marginBottom: 0 }}>
              {t('importStep.noUsersImpact', {
                defaultValue:
                  'Assignee/reporter fields remain unassigned, mentions become plain text, and commenter names become Anonymous.',
              })}
            </Typography.Paragraph>
          </Card>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <Switch checked={addUsers} onChange={setAddUsers} style={{ marginRight: 12 }} />
              <span style={{ color: palette.success, fontWeight: 600, fontSize: 18 }}>
                {t('importStep.addUsersIntoSpace', {
                  defaultValue: 'Add users into your space',
                })}
              </span>
            </div>
            <Typography.Paragraph style={{ color: palette.textSecondary, marginBottom: 20 }}>
              {t('importStep.addUsersHelp', {
                defaultValue:
                  "Enter a valid email address for each user. Users without valid emails won't be imported.",
              })}
            </Typography.Paragraph>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: palette.textSecondary,
                fontWeight: 500,
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              <span style={{ flex: 2, paddingLeft: 8 }}>
                <UserOutlined style={{ marginRight: 8 }} />
                {t('importStep.usersInCsv', {
                  defaultValue: 'Users in CSV ({{count}})',
                  count: csvUserRows.length,
                })}
              </span>
              <span style={{ width: 40 }}></span>
              <span style={{ flex: 3 }}>
                <UserAddOutlined style={{ marginRight: 8 }} />
                {t('importStep.usersMovingToWorklenz', {
                  defaultValue: 'Users moving to Worklenz ({{count}})',
                  count: usersMovingCount,
                })}
              </span>
            </div>

            <FixedSizeList
              width="100%"
              height={usersListHeight}
              itemCount={csvUserRows.length}
              itemSize={MOVE_USERS_ROW_HEIGHT}
              itemData={userListData}
              overscanCount={6}
            >
              {MoveUsersRow}
            </FixedSizeList>
          </>
        )}
      </div>
    );
  }

  return null;
};
