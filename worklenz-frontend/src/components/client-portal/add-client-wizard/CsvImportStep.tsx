import { InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Spin, Typography, Upload } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { ImportValidation } from '@/api/client-portal/company-users-api';
import { CSV_MAX_BYTES, CSV_MAX_ROWS, CsvParseError } from './csv-import';
import { CsvProblemRows } from './CsvProblemRows';
import type { CsvRequestFailure } from './useCsvImport';

const { Text } = Typography;
const { Dragger } = Upload;

interface CsvImportStepProps {
  fileName: string | null;
  isBusy: boolean;
  error: CsvParseError | CsvRequestFailure | null;
  validation: ImportValidation | null;
  onChooseFile: (file: File) => void;
  onClear: () => void;
}

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** Step 2 of "Import from CSV": choose a file, then see what would happen to each row. */
export const CsvImportStep = ({
  fileName,
  isBusy,
  error,
  validation,
  onChooseFile,
  onClear,
}: CsvImportStepProps) => {
  const { t } = useTranslation('client-portal-add-client');

  const errorMessage = (problem: CsvParseError | CsvRequestFailure): string => {
    switch (problem.kind) {
      case 'notCsv':
        return t('csv.error.notCsv', { defaultValue: 'Choose a .csv file.' });
      case 'tooLarge':
        return t('csv.error.tooLarge', {
          size: megabytes(CSV_MAX_BYTES),
          defaultValue: 'That file is too large. The limit is {{size}} MB.',
        });
      case 'empty':
        return t('csv.error.empty', { defaultValue: 'The file has no rows to import.' });
      case 'unreadable':
        return t('csv.error.unreadable', {
          defaultValue: 'That file could not be read. Check that it is a valid CSV and try again.',
        });
      case 'missingColumns':
        return t('csv.error.missingColumns', {
          columns: problem.columns
            .map(column =>
              column === 'first_name'
                ? t('csv.columnNames.firstName', { defaultValue: 'First name' })
                : t('csv.columnNames.email', { defaultValue: 'Email' })
            )
            .join(', '),
          defaultValue: 'The file needs a header row with these columns: {{columns}}.',
        });
      case 'tooManyRows':
        return t('csv.error.tooManyRows', {
          count: problem.count,
          max: CSV_MAX_ROWS,
          defaultValue: 'The file has {{count}} rows. An import can have at most {{max}}.',
        });
      case 'requestFailed':
        return (
          problem.message ||
          t('csv.error.requestFailed', {
            defaultValue: 'The file could not be checked. Please try again.',
          })
        );
      default:
        return '';
    }
  };

  if (isBusy) {
    return (
      <Flex vertical align="center" gap={12} style={{ padding: '32px 0' }}>
        <Spin />
        <Text type="secondary">{t('csv.checking', { defaultValue: 'Checking your file...' })}</Text>
      </Flex>
    );
  }

  if (fileName && validation) {
    const { summary } = validation;

    return (
      <Flex vertical gap={12}>
        <Flex justify="space-between" align="center" gap={12} wrap="wrap">
          <Text strong>{fileName}</Text>
          <Button size="small" onClick={onClear}>
            {t('csv.chooseAnother', { defaultValue: 'Choose another file' })}
          </Button>
        </Flex>

        <Alert
          type={summary.valid === 0 ? 'error' : summary.invalid > 0 ? 'warning' : 'success'}
          showIcon
          message={
            summary.valid === 0
              ? t('csv.summary.noneReady', {
                  defaultValue: 'None of the rows can be imported.',
                })
              : t('csv.summary.ready', {
                  valid: summary.valid,
                  total: summary.total,
                  defaultValue: '{{valid}} of {{total}} rows are ready to import.',
                })
          }
          description={
            summary.valid > 0
              ? t('csv.summary.detail', {
                  newCompanies: summary.new_companies,
                  existingCompanies: summary.existing_companies,
                  defaultValue:
                    '{{newCompanies}} new companies will be created and {{existingCompanies}} existing companies will get more users. Rows with problems are skipped. Nobody is emailed. Invite them from the list afterwards.',
                })
              : undefined
          }
        />

        <CsvProblemRows rows={validation.rows} />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={12}>
      <Text type="secondary">
        {t('csv.helper', {
          defaultValue:
            'Upload a CSV with a header row and these columns: Company, First name, Last name, Email. First name and Email are required.',
        })}
      </Text>

      {error && <Alert type="error" showIcon message={errorMessage(error)} />}

      <Dragger
        accept=".csv,text/csv"
        multiple={false}
        maxCount={1}
        showUploadList={false}
        beforeUpload={file => {
          onChooseFile(file);
          // The file is read in the browser and checked by the server, never uploaded as-is.
          return false;
        }}
        aria-label={t('csv.dropzoneLabel', { defaultValue: 'Choose a CSV file' })}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          {t('csv.dropzone', { defaultValue: 'Click to choose a CSV file, or drag it here' })}
        </p>
        <p className="ant-upload-hint">
          {t('csv.dropzoneHint', {
            max: CSV_MAX_ROWS,
            defaultValue: 'Up to {{max}} rows.',
          })}
        </p>
      </Dragger>
    </Flex>
  );
};
