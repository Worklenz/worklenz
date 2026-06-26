import {
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Table,
  TableProps,
  Tooltip,
  Typography,
  DeleteOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
  EditOutlined,
  Modal,
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
import { alertService } from '@/services/alerts/alertService';
import { useAppSelector } from '@/app/store';

const LabelsSettings = () => {
  const { t } = useTranslation('settings/labels');
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('pageTitle', 'Manage Labels'));
  const themeMode = useAppSelector(state => state.themeReducer.mode);

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

  const deleteLabel = async (id: string, force: boolean = false) => {
    try {
      const response = await labelsApiService.deleteById(id, force);
      if (response.done) {
        getLabels();
        const message = response.message || 'Label deleted successfully';
        alertService.success('Success', message);
      } else {
        // Other error
        const message = response.message || 'Failed to delete label';
        if (message && !message.startsWith('$')) {
          alertService.error('Delete Failed', message);
        }
      }
    } catch (error: any) {
      logger.error('Failed to delete label:', error);
      // Error message is typically handled by API interceptor, but handle edge cases
      const errorMessage = error?.response?.data?.message || error?.message;
      if (errorMessage && !errorMessage.startsWith('$')) {
        alertService.error('Delete Failed', errorMessage);
      }
    }
  };

  const handleDeleteClick = (record: ITaskLabel, e: React.MouseEvent) => {
    e.stopPropagation();
    const usageCount = record.usage || 0;
    const labelName = record.name || 'this label';
    const isInUse = usageCount > 0;

    const isDark = themeMode === 'dark';
    const textColor = isDark ? '#d9d9d9' : '#262626';
    const secondaryTextColor = isDark ? '#8c8c8c' : '#595959';

    const plural = usageCount > 1 ? 's' : '';

    Modal.confirm({
      title: t('deleteConfirmTitle', 'Delete Label'),
      icon: <ExclamationCircleFilled style={{ color: '#ff9800' }} />,
      content: (
        <div>
          {isInUse ? (
            <>
              <Typography.Text style={{ color: textColor }}>
                {t('labelInUseMessage', {
                  labelName,
                  count: usageCount,
                  plural,
                  defaultValue: `The label "${labelName}" is currently assigned to ${usageCount} task${plural}.`,
                })}
              </Typography.Text>
              <br />
              <Typography.Text strong style={{ marginTop: 8, display: 'block', color: '#ff4d4f' }}>
                {t('labelDeleteWarning', {
                  count: usageCount,
                  plural,
                  defaultValue: `⚠️ Deleting this label will remove it from all ${usageCount} assigned task${plural}. This action cannot be undone.`,
                })}
              </Typography.Text>
            </>
          ) : (
            <Typography.Text style={{ color: textColor }}>
              {t('deleteConfirmMessage', {
                labelName,
                defaultValue: `Are you sure you want to delete the label "${labelName}"? This action cannot be undone.`,
              })}
            </Typography.Text>
          )}
        </div>
      ),
      okText: t('deleteButton', 'Delete'),
      cancelText: t('cancelButton', 'Cancel'),
      okType: 'danger',
      centered: true,
      width: 500,
      onOk: async () => {
        // Delete with force if label is in use
        await deleteLabel(record.id!, isInUse);
      },
    });
  };

  const handleCreateClick = () => {
  setSelectedLabelId(null);
  setShowDrawer(true);
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
                onClick={e => {
                  e.stopPropagation();
                  handleEditClick(record.id!);
                }}
              />
            </Tooltip>
            <Tooltip title={t('deleteTooltip', 'Delete')}>
              <Button
                shape="default"
                icon={<DeleteOutlined />}
                size="small"
                onClick={e => handleDeleteClick(record, e)}
              />
            </Tooltip>
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
              placeholder={t('search', { defaultValue: 'Search' })}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />
             <Button type="primary" onClick={handleCreateClick}>
      {t('createLabelButton', 'Create Label')}
    </Button>

            <Tooltip
              title={t('pinTooltip', 'Click to pin this into the main menu')}
              trigger={'hover'}
            >
              {/* this button pin this route to navbar  */}
              <PinRouteToNavbarButton name="labels" path="/worklenz/settings/labels" />
            </Tooltip>
          </Flex>
        </Flex>
      }
    >
      <Table
        locale={{
  emptyText: <Empty description="No labels found" />,
}}
        loading={loading}
        className="custom-two-colors-row-table"
        dataSource={filteredData}
        columns={columns}
        rowKey={record => record.id!}
        onRow={record => ({
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
