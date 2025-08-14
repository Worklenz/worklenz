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
  DeleteOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
  EditOutlined,
} from '@/shared/antd-imports';
import { useEffect, useMemo, useState } from 'react';

import PinRouteToNavbarButton from '@/components/PinRouteToNavbarButton';
import { useTranslation } from 'react-i18next';
import { ITaskLabel } from '@/types/label.type';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';
import CustomColorLabel from '@components/task-list-common/labelsSelector/custom-color-label';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import logger from '@/utils/errorLogger';
import LabelsDrawer from './labels-drawer';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_labels_visit } from '@/shared/worklenz-analytics-events';

const LabelsSettings = () => {
  const { t } = useTranslation('settings/labels');
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('pageTitle', 'Manage Labels'));

  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
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
    trackMixpanelEvent(evt_settings_labels_visit);
  }, [trackMixpanelEvent]);

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

  const handleEditClick = (id: string) => {
    setSelectedLabelId(id);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    setSelectedLabelId(null);
    setShowDrawer(false);
    getLabels();
  };


  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'label',
      title: t('labelColumn', 'Label'),
      onCell: record => ({
        onClick: () => handleEditClick(record.id!),
      }),
      render: (record: ITaskLabel) => <CustomColorLabel label={record} />,
    },
    {
      key: 'associatedTask',
      title: t('associatedTaskColumn', 'Associated Task Count'),
      render: (record: ITaskLabel) => <Typography.Text>{record.usage}</Typography.Text>,
    },
    {
      key: 'actionBtns',
      width: 100,
      render: (record: ITaskLabel) => (
        <div className="action-button opacity-0 transition-opacity duration-200">
          <Flex gap={4}>
            <Tooltip title={t('editTooltip', 'Edit')}>
              <Button
                shape="default"
                icon={<EditOutlined />}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditClick(record.id!);
                }}
              />
            </Tooltip>
            <Popconfirm
              title={t('deleteConfirmTitle', 'Are you sure you want to delete this?')}
              icon={<ExclamationCircleFilled style={{ color: '#ff9800' }} />}
              okText={t('deleteButton', 'Delete')}
              cancelText={t('cancelButton', 'Cancel')}
              onConfirm={() => deleteLabel(record.id!)}
            >
              <Tooltip title={t('deleteTooltip', 'Delete')}>
                <Button shape="default" icon={<DeleteOutlined />} size="small" />
              </Tooltip>
            </Popconfirm>
          </Flex>
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
              placeholder={t('searchPlaceholder', 'Search by name')}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />

            <Tooltip title={t('pinTooltip', 'Click to pin this into the main menu')} trigger={'hover'}>
              {/* this button pin this route to navbar  */}
              <PinRouteToNavbarButton name="labels" path="/worklenz/settings/labels" />
            </Tooltip>
          </Flex>
        </Flex>
      }
    >
      <Table
        locale={{
          emptyText: <Typography.Text>{t('emptyText', 'Labels can be created while updating or creating tasks.')}</Typography.Text>,
        }}
        loading={loading}
        className="custom-two-colors-row-table"
        dataSource={filteredData}
        columns={columns}
        rowKey={record => record.id!}
        onRow={(record) => ({
          style: { cursor: 'pointer' },
          onClick: () => handleEditClick(record.id!),
        })}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: 20,
          pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
          size: 'small',
        }}
      />

      <LabelsDrawer
        drawerOpen={showDrawer}
        labelId={selectedLabelId}
        drawerClosed={handleDrawerClose}
      />
    </Card>
  );
};

export default LabelsSettings;
