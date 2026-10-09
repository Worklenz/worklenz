import { Table, Tag, Typography } from '@/shared/antd-imports';
import type { TableProps } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { ImportRowResult } from '@/api/client-portal/company-users-api';

const { Text } = Typography;

const ERROR_DEFAULTS: Record<string, string> = {
  missing_first_name: 'First name is missing',
  missing_email: 'Email is missing',
  invalid_email: 'Email is not valid',
  duplicate_in_file: 'Email appears earlier in the file',
  email_in_use: 'Email already belongs to a client user',
  company_name_too_long: 'Company name is over 60 characters',
  client_name_taken: 'A client with this name already exists',
  import_failed: 'Could not be imported',
};

interface CsvProblemRowsProps {
  rows: ImportRowResult[];
}

/** The rows of a CSV that have a problem, with each problem in plain words. */
export const CsvProblemRows = ({ rows }: CsvProblemRowsProps) => {
  const { t } = useTranslation('client-portal-add-client');
  const problems = rows.filter(row => row.status === 'error');

  const columns: TableProps<ImportRowResult>['columns'] = [
    {
      key: 'row',
      title: t('csv.columns.row', { defaultValue: 'Row' }),
      dataIndex: 'row',
      width: 64,
    },
    {
      key: 'person',
      title: t('csv.columns.person', { defaultValue: 'Person' }),
      render: (_value: unknown, record) => <Text>{record.name || record.email || '—'}</Text>,
    },
    {
      key: 'problem',
      title: t('csv.columns.problem', { defaultValue: 'Problem' }),
      render: (_value: unknown, record) => (
        <>
          {record.errors.map(code => (
            <Tag key={code} color="error" style={{ marginBottom: 2 }}>
              {t(`csv.errors.${code}`, { defaultValue: ERROR_DEFAULTS[code] ?? code })}
            </Tag>
          ))}
        </>
      ),
    },
  ];

  if (problems.length === 0) return null;

  return (
    <Table<ImportRowResult>
      size="small"
      rowKey="row"
      columns={columns}
      dataSource={problems}
      pagination={false}
      scroll={{ y: 180 }}
      aria-label={t('csv.problemsLabel', { defaultValue: 'Rows with problems' })}
    />
  );
};
