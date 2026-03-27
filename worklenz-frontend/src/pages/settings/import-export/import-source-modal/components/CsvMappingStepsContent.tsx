import React from 'react';
import {
  AutoComplete,
  Card,
  Checkbox,
  Collapse,
  InboxOutlined,
  Input,
  Select,
  Switch,
  TableOutlined,
  Typography,
  UserAddOutlined,
  UserOutlined,
} from '@/shared/antd-imports';

interface WorkTypeOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  level: number;
}

interface CsvMappingStepsContentProps {
  step: number;
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
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
  workTypeOptions: WorkTypeOption[];
  workTypeMapping: Record<string, string>;
  setWorkTypeMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  csvUserRows: string[];
  userEmails: Record<string, string>;
  setUserEmails: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addUsers: boolean;
  setAddUsers: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CsvMappingStepsContent: React.FC<CsvMappingStepsContentProps> = ({
  step,
  t,
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
  workTypeOptions,
  workTypeMapping,
  setWorkTypeMapping,
  csvUserRows,
  userEmails,
  setUserEmails,
  addUsers,
  setAddUsers,
}) => {
  if (step === 2) {
    return (
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
          {t('importStep.mapSpaceFields', { defaultValue: 'Map space fields' })}
        </Typography.Title>
        <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
          We&apos;ve automatically mapped a few columns from the CSV file to{' '}
          <b>Worklenz fields</b>. Verify and{' '}
          <a href="#" style={{ color: '#4096ff' }}>
            map any remaining columns
          </a>
          . Map issue type field to bring in issue type values and map issue ID and parent fields
          to establish hierarchies.{' '}
          <a href="#" style={{ color: '#4096ff' }}>
            Read about mapping issue types
          </a>
        </Typography.Paragraph>

        <Collapse ghost style={{ marginBottom: 16 }} bordered={false} expandIconPosition="start">
          <Collapse.Panel
            header={<span style={{ color: '#4096ff', fontSize: 15 }}>&gt; Date and time format options</span>}
            key="dateTimeFormat"
            style={{ background: 'transparent', border: 'none', padding: 0 }}
          >
            <div style={{ display: 'flex', gap: 24, marginBottom: 8, marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                  Date and time format<span style={{ color: '#ff4d4f' }}>*</span>
                </Typography.Text>
                <Input
                  placeholder="dd/MMM/yy h:mm a"
                  style={{
                    width: '100%',
                    background: '#18181a',
                    color: '#fff',
                    border: '1px solid #333',
                  }}
                />
                <Typography.Text style={{ color: '#888', fontSize: 12 }}>
                  e.g. dd/MMM/yy h:mm a
                </Typography.Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                  Locale
                </Typography.Text>
                <Select defaultValue="en" style={{ width: '100%' }}>
                  <Select.Option value="en">English (US)</Select.Option>
                  <Select.Option value="fr">French (FR)</Select.Option>
                  <Select.Option value="de">German (DE)</Select.Option>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                  Timezone
                </Typography.Text>
                <Select defaultValue="colombo" style={{ width: '100%' }}>
                  <Select.Option value="colombo">Asia/Colombo (UTC+5:30)</Select.Option>
                  <Select.Option value="newyork">America/New_York (UTC-5)</Select.Option>
                  <Select.Option value="london">Europe/London (UTC+0)</Select.Option>
                </Select>
              </div>
            </div>
          </Collapse.Panel>
        </Collapse>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <Input
            placeholder={t('importStep.searchCsvColumns', {
              defaultValue: 'Search columns in CSV',
            })}
            style={{
              width: 260,
              background: '#18181a',
              color: '#fff',
              border: '1px solid #333',
            }}
          />
          <Select defaultValue="all" style={{ width: 120 }}>
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
              color: '#b0b0b0',
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
            <div style={{ color: '#888', margin: '24px 0' }}>
              {t('importStep.uploadCsvToMapFields', {
                defaultValue: 'Upload a CSV file to map fields.',
              })}
            </div>
          ) : (
            csvColumns.map(col => (
              <div
                key={col}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#23272f',
                  borderRadius: 6,
                  marginBottom: 4,
                  minHeight: 44,
                }}
              >
                <span style={{ flex: 2, paddingLeft: 8, color: '#fff' }}>{col}</span>
                <span style={{ flex: 2 }}>
                  <AutoComplete
                    placeholder={t('importStep.selectOrTypeField', {
                      defaultValue: 'Select or type a field to map',
                    })}
                    style={{ width: '100%' }}
                    value={fieldMappings[col] || ''}
                    onChange={val => setFieldMappings(m => ({ ...m, [col]: val }))}
                    options={worklenzFieldOptions}
                    allowClear
                    filterOption={(inputValue, option) =>
                      option?.label?.toLowerCase().includes(inputValue.toLowerCase()) || false
                    }
                  />
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
        (filter === 'all' || (filter === 'mapped' ? workTypeMapping[value] : !workTypeMapping[value]))
    );

    const emptyValuesMessage = statusColumnKey
      ? t('importStep.noStatusValuesFound', 'No values found in the mapped Status column.')
      : t('importStep.selectStatusColumnPrompt', 'Map a CSV column to Status to see values.');

    return (
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
          {t('importStep.mapValues', 'Map values to work types')}
        </Typography.Title>
        <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
          {t(
            'importStep.mapValuesHelp',
            'Build more structure into your space by mapping values in your Status column to Worklenz statuses.'
          )}{' '}
          <a href="#" style={{ color: '#4096ff' }}>
            {t('importStep.mapValuesDocs', 'Read about mapping work types')}
          </a>
        </Typography.Paragraph>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Input
            placeholder={t('importStep.searchValues', { defaultValue: 'Search values' })}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            style={{
              width: 220,
              background: '#18181a',
              color: '#fff',
              border: '1px solid #333',
            }}
          />
          <Select
            value={filter}
            onChange={setFilter}
            style={{ width: 120 }}
            styles={{ popup: { root: { background: '#23272f', color: '#fff' } } }}
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
            color: '#b0b0b0',
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
            <TableOutlined style={{ marginRight: 8, color: '#4096ff' }} />
            {t('importStep.worklenzWorkTypes', { defaultValue: 'Worklenz work types' })}
          </span>
        </div>

        {filteredValues.length === 0 ? (
          <div style={{ color: '#888', margin: '24px 0' }}>{emptyValuesMessage}</div>
        ) : (
          filteredValues.map(value => (
            <div
              key={value}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#18181a',
                borderRadius: 8,
                marginBottom: 8,
                minHeight: 44,
              }}
            >
              <span style={{ flex: 2, paddingLeft: 8, color: '#fff', fontSize: 16 }}>{value}</span>
              <span style={{ flex: 1, textAlign: 'center', color: '#b0b0b0', fontSize: 20 }}>
                &rarr;
              </span>
              <span style={{ flex: 2 }}>
                <Select
                  value={workTypeMapping[value] || undefined}
                  onChange={val => setWorkTypeMapping(m => ({ ...m, [value]: val }))}
                  placeholder={t('importStep.selectWorkType', {
                    defaultValue: 'Select work type',
                  })}
                  style={{
                    width: '100%',
                    background: '#23272f',
                    color: '#fff',
                    border: '1px solid #333',
                  }}
                  styles={{ popup: { root: { background: '#23272f', color: '#fff' } } }}
                  popupRender={menu => (
                    <>
                      <div
                        style={{
                          padding: '8px 12px',
                          color: '#b0b0b0',
                          fontWeight: 500,
                          fontSize: 13,
                        }}
                      >
                        MAP TO A SUGGESTED WORK TYPE
                      </div>
                      {menu}
                      <div style={{ borderTop: '1px solid #333', margin: '8px 0' }} />
                      <div
                        style={{ padding: '8px 12px', color: '#4096ff', cursor: 'pointer' }}
                        onClick={() => {
                          setWorkTypeMapping(m => {
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
                  {workTypeOptions.map(wt => (
                    <Select.Option key={wt.key} value={wt.key} label={wt.label}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {wt.icon}
                        <span style={{ color: '#fff' }}>{wt.label}</span>
                        <span style={{ color: '#b0b0b0', fontSize: 13, marginLeft: 8 }}>
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

    return (
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ color: '#fff', marginBottom: 16 }}>
          {t('importStep.moveUsersToWorklenz', { defaultValue: 'Move users to Worklenz' })}
        </Typography.Title>

        {noUsers ? (
          <Card
            style={{
              marginBottom: 24,
              maxWidth: 680,
              background: '#19345c',
              borderColor: '#2f4f80',
            }}
          >
            <Typography.Title level={4} style={{ color: '#fff', marginBottom: 8 }}>
              {t('importStep.noUsersInCsvTitle', {
                defaultValue: 'There are no users in the CSV file',
              })}
            </Typography.Title>
            <Typography.Paragraph style={{ color: '#cbd5e1', marginBottom: 12 }}>
              {t('importStep.noUsersInCsvDescription', {
                defaultValue:
                  'You can proceed with import, or restart with a CSV that includes user data. If you proceed:',
              })}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ color: '#fff', marginBottom: 0 }}>
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
              <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 18 }}>
                {t('importStep.addUsersIntoSpace', {
                  defaultValue: 'Add users into your space',
                })}
              </span>
            </div>
            <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 20 }}>
              {t('importStep.addUsersHelp', {
                defaultValue:
                  "Enter a valid email address for each user. Users without valid emails won't be imported.",
              })}
            </Typography.Paragraph>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#b0b0b0',
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

            {csvUserRows.map((user, idx) => (
              <div
                key={`${user}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#23272f',
                  borderRadius: 6,
                  marginBottom: 4,
                  minHeight: 44,
                }}
              >
                <span style={{ flex: 2, paddingLeft: 8, color: '#fff' }}>{user}</span>
                <span style={{ width: 40, textAlign: 'center', color: '#4096ff', fontSize: 20 }}>
                  &rarr;
                </span>
                <span style={{ flex: 3 }}>
                  <Input
                    placeholder={t('importStep.enterEmail', { defaultValue: 'Enter email' })}
                    value={userEmails[user] || ''}
                    onChange={e => setUserEmails(emails => ({ ...emails, [user]: e.target.value }))}
                    style={{
                      width: '100%',
                      background: '#18181a',
                      color: '#fff',
                      border: '1px solid #333',
                    }}
                  />
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  return null;
};
