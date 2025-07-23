import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useMemo, useState } from 'react';

import PinRouteToNavbarButton from '../../../components/PinRouteToNavbarButton';
import { useTranslation } from 'react-i18next';
import { DeleteOutlined, ExclamationCircleFilled, SearchOutlined } from '@/shared/antd-imports';
import { ITaskLabel } from '@/types/label.type';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';
import CustomColorLabel from '@components/task-list-common/labelsSelector/custom-color-label';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import logger from '@/utils/errorLogger';

const LabelsSettings = () => {
  const { t } = useTranslation('settings/labels');
  useDocumentTitle('Manage Labels');

  const [searchQuery, setSearchQuery] = useState('');
  const [labels, setLabels] = useState<ITaskLabel[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredData = useMemo(
    () =>
      labels.filter(record =>
        Object.values(record).some(value =>
          value?.toString().toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
    [labels, searchQuery]
  );

  const getLabels = useMemo(() => {
    setLoading(true);
    return async () => {
      const response = await labelsApiService.getLabels();
      if (response.done) {
        setLabels(response.body as ITaskLabel[]);
      }
      setLoading(false);
    };
  }, []);

  useEffect(() => {
    getLabels();
  }, [getLabels]);

  const deleteLabel = async (id: string) => {
    try {
      const response = await labelsApiService.deleteById(id);
      if (response.done) {
        getLabels();
      }
    } catch (error) {
      logger.error('Failed to delete label:', error);
    }
  };

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'label',
      title: t('labelColumn'),
      render: (record: ITaskLabel) => <CustomColorLabel label={record} />,
    },
    {
      key: 'associatedTask',
      title: t('associatedTaskColumn'),
      render: (record: ITaskLabel) => <Typography.Text>{record.usage}</Typography.Text>,
    },
    {
      key: 'actionBtns',
      width: 60,
      render: (record: ITaskLabel) => (
        <div className="action-button opacity-0 transition-opacity duration-200">
          <Popconfirm
            title="Are you sure you want to delete this?"
            icon={<ExclamationCircleFilled style={{ color: '#ff9800' }} />}
            okText="Delete"
            cancelText="Cancel"
            onConfirm={() => deleteLabel(record.id!)}
          >
            <Button shape="default" icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="flex-end">
          <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 400 }}>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />

            <Tooltip title={t('pinTooltip')} trigger={'hover'}>
              {/* this button pin this route to navbar  */}
              <PinRouteToNavbarButton name="labels" path="/worklenz/settings/labels" />
            </Tooltip>
          </Flex>
        </Flex>
      }
    >
      <Table
        locale={{
          emptyText: <Typography.Text>{t('emptyText')}</Typography.Text>,
        }}
        loading={loading}
        className="custom-two-colors-row-table"
        dataSource={filteredData}
        columns={columns}
        rowKey={record => record.id!}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: 20,
          pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
          size: 'small',
        }}
      />
    </Card>
  );
};

export default LabelsSettings;
