import React from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import {
  Card,
  Checkbox,
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
export const CREATE_NEW_STATUS_PREFIX = '__create_new_status__:';

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
  pendingNewStatuses: Record<string, { name: string; categoryId: string }>;
  setPendingNewStatuses: React.Dispatch<
    React.SetStateAction<Record<string, { name: string; categoryId: string }>>
  >;
  statusCategories: Array<{ id?: string; name?: string; color_code?: string }>;
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

interface StatusValueRowProps {
  value: string;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  palette: MoveUserListData['palette'];
  statusOptions: WorkTypeOption[];
  statusValueMapping: Record<string, string>;
  setStatusValueMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendingNewStatuses: Record<string, { name: string; categoryId: string }>;
  setPendingNewStatuses: React.Dispatch<
    React.SetStateAction<Record<string, { name: string; categoryId: string }>>
  >;
  statusCategories: Array<{ id?: string; name?: string; color_code?: string }>;
  defaultCategoryId: string;
}

const StatusValueRow: React.FC<StatusValueRowProps> = ({
  value,
  t,
  palette,
  statusOptions,
  statusValueMapping,
  setStatusValueMapping,
  pendingNewStatuses,
  setPendingNewStatuses,
  statusCategories,
  defaultCategoryId,
}) => {
  const [searchText, setSearchText] = React.useState('');
  const storedValue = statusValueMapping[value];
  const isPendingNew = !!storedValue?.startsWith(CREATE_NEW_STATUS_PREFIX);
  const pendingName = pendingNewStatuses[value]?.name;

  const trimmedSearch = searchText.trim();
  const matchesExisting = statusOptions.some(
    wt => wt.label.trim().toLowerCase() === trimmedSearch.toLowerCase()
  );
  const showCreateOption = trimmedSearch.length > 0 && !matchesExisting;

  const options = [
    ...statusOptions.map(wt => ({ value: wt.key, label: wt.label, wt })),
    ...(showCreateOption
      ? [
          {
            value: `${CREATE_NEW_STATUS_PREFIX}${trimmedSearch}`,
            label: t('importStep.createNewStatus', {
              defaultValue: 'Create new status "{{name}}"',
              name: trimmedSearch,
            }),
            wt: null,
          },
        ]
      : []),
    // Keep whatever "create new status: X" choice is already selected visible in the
    // closed Select even after the search text is cleared.
    ...(isPendingNew && pendingName && !showCreateOption
      ? [
          {
            value: storedValue,
            label: t('importStep.newStatusChip', {
              defaultValue: 'New status "{{name}}"',
              name: pendingName,
            }),
            wt: null,
          },
        ]
      : []),
  ];

  return (
    <div
      style={{
        background: palette.inputBg,
        borderRadius: 8,
        marginBottom: 8,
        padding: '4px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
        <span style={{ flex: 2, paddingLeft: 8, color: palette.text, fontSize: 16 }}>{value}</span>
        <span style={{ flex: 1, textAlign: 'center', color: palette.textSecondary, fontSize: 20 }}>
          &rarr;
        </span>
        <span style={{ flex: 2 }}>
          <Select
            showSearch
            value={storedValue || undefined}
            searchValue={searchText}
            onSearch={setSearchText}
            onChange={val => {
              setSearchText('');
              if (val.startsWith(CREATE_NEW_STATUS_PREFIX)) {
                const name = val.slice(CREATE_NEW_STATUS_PREFIX.length).trim();
                setStatusValueMapping(m => ({ ...m, [value]: val }));
                setPendingNewStatuses(p => ({
                  ...p,
                  [value]: { name, categoryId: defaultCategoryId },
                }));
                return;
              }
              setStatusValueMapping(m => ({ ...m, [value]: val }));
              setPendingNewStatuses(p => {
                if (!p[value]) return p;
                const copy = { ...p };
                delete copy[value];
                return copy;
              });
            }}
            filterOption={false}
            placeholder={t('importStep.selectWorkType', { defaultValue: 'Select status' })}
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
                  {showCreateOption
                    ? t('importStep.typeToCreateStatus', 'TYPE A NAME TO CREATE A NEW STATUS')
                    : 'MAP TO A SUGGESTED STATUS'}
                </div>
                {menu}
                <div style={{ borderTop: `1px solid ${palette.border}`, margin: '8px 0' }} />
                <div
                  style={{ padding: '8px 12px', color: palette.primary, cursor: 'pointer' }}
                  onClick={() => {
                    setSearchText('');
                    setStatusValueMapping(m => {
                      const copy = { ...m };
                      delete copy[value];
                      return copy;
                    });
                    setPendingNewStatuses(p => {
                      if (!p[value]) return p;
                      const copy = { ...p };
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
            options={options}
          />
        </span>
      </div>
      {isPendingNew && statusCategories.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 8, paddingBottom: 4 }}>
          <span style={{ flex: 2 }} />
          <span style={{ flex: 1 }} />
          <span style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text style={{ color: palette.primary, fontSize: 12, whiteSpace: 'nowrap' }}>
              {t('importStep.willCreateStatusIn', { defaultValue: 'Will create in:' })}
            </Typography.Text>
            <Select
              size="small"
              value={pendingNewStatuses[value]?.categoryId || defaultCategoryId}
              onChange={categoryId =>
                setPendingNewStatuses(p => ({
                  ...p,
                  [value]: { name: p[value]?.name || '', categoryId },
                }))
              }
              style={{ minWidth: 130 }}
              options={statusCategories.map(cat => ({ value: cat.id, label: cat.name }))}
            />
          </span>
        </div>
      )}
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
  pendingNewStatuses,
  setPendingNewStatuses,
  statusCategories,
  csvUserRows,
  userEmails,
  setUserEmails,
  addUsers,
  setAddUsers,
}) => {
  const defaultCategoryId = React.useMemo(() => {
    const todoCategory = statusCategories.find(cat => /to.?do/i.test(cat.name || ''));
    return todoCategory?.id || statusCategories[0]?.id || '';
  }, [statusCategories]);
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
          searchLabel: option.label.toLowerCase(),
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
                              ? [{ value: storedValue, label: displayValue, searchLabel: String(displayValue).toLowerCase() }]
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
            <StatusValueRow
              key={value}
              value={value}
              t={t}
              palette={palette}
              statusOptions={statusOptions}
              statusValueMapping={statusValueMapping}
              setStatusValueMapping={setStatusValueMapping}
              pendingNewStatuses={pendingNewStatuses}
              setPendingNewStatuses={setPendingNewStatuses}
              statusCategories={statusCategories}
              defaultCategoryId={defaultCategoryId}
            />
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
              width: '100%',
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
