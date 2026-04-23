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
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
} from '@ant-design/icons';
import { ITaskLabel } from '@/types/label.type';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';
import CustomColorLabel from '@components/task-list-common/labelsSelector/custom-color-label';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import logger from '@/utils/errorLogger';
import LabelsDrawer from './labels-drawer';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_labels_visit } from '@/shared/worklenz-analytics-events';
import { alertService } from '@/services/alerts/alertService';

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

  const handleEditClick = (id: string, e?: React.MouseEvent<HTMLElement>) => {
    e?.stopPropagation();
    setSelectedLabelId(id);
    setShowDrawer(true);
  };

  const handleDeleteClick = async (record: ITaskLabel) => {
    const usageCount = record.usage || 0;
    const isInUse = usageCount > 0;
    // Delete with force if label is in use
    await deleteLabel(record.id!, isInUse);
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
      render: (record: ITaskLabel) => (
        <CustomColorLabel label={{ ...record, names: record.name ? [record.name] : [] }} />
      ),
    },
    {
      key: 'associatedTask',
      title: t('associatedTaskColumn', 'Associated Task Count'),
      render: (record: ITaskLabel) => <Typography.Text>{record.usage}</Typography.Text>,
    },
    {
      key: 'actionBtns',
      width: 100,
      render: (record: ITaskLabel) => {
        const usageCount = record.usage || 0;
        const labelName = record.name || 'this label';
        const plural = usageCount > 1 ? 's' : '';
        const isInUse = usageCount > 0;

        return (
          <div className="row-action-buttons" onClick={e => e.stopPropagation()}>
            <Flex gap={4}>
              <Tooltip title={t('editTooltip', 'Edit')}>
                <Button
                  shape="default"
                  icon={<EditOutlined />}
                  size="small"
                  onClick={e => handleEditClick(record.id!, e)}
                />
              </Tooltip>
              <Popconfirm
                title={
                  isInUse
                    ? t('deleteConfirmTitle', 'Delete Label')
                    : t('deleteConfirmTitle', 'Delete Label')
                }
                description={
                  isInUse ? (
                    <div style={{ maxWidth: 300 }}>
                      <Typography.Text>
                        {t('labelInUseMessage', {
                          labelName,
                          count: usageCount,
                          plural,
                          defaultValue: `The label "${labelName}" is currently assigned to ${usageCount} task${plural}.`,
                        })}
                      </Typography.Text>
                      <br />
                      <Typography.Text
                        strong
                        style={{ marginTop: 8, display: 'block', color: '#ff4d4f' }}
                      >
                        {t('labelDeleteWarning', {
                          count: usageCount,
                          plural,
                          defaultValue: `⚠️ Deleting this label will remove it from all ${usageCount} assigned task${plural}.`,
                        })}
                      </Typography.Text>
                    </div>
                  ) : (
                    t('deleteConfirmMessage', {
                      labelName,
                      defaultValue: `Are you sure you want to delete the label "${labelName}"?`,
                    })
                  )
                }
                icon={<ExclamationCircleFilled style={{ color: '#ff9800' }} />}
                okText={t('deleteButton', 'Delete')}
                cancelText={t('cancelButton', 'Cancel')}
                okType="danger"
                onConfirm={e => {
                  e?.stopPropagation();
                  handleDeleteClick(record);
                }}
                onCancel={e => e?.stopPropagation()}
              >
                <Tooltip title={t('deleteTooltip', 'Delete')}>
                  <Button
                    shape="default"
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={e => e.stopPropagation()}
                  />
                </Tooltip>
              </Popconfirm>
            </Flex>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <style>
        {`
          .custom-two-colors-row-table .row-action-buttons {
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
          }
          
          .custom-two-colors-row-table .ant-table-tbody > tr:hover .row-action-buttons {
            opacity: 1;
          }
        `}
      </style>
      <Card
        style={{ width: '100%' }}
        title={
          <Flex justify="flex-end">
            <Flex
              gap={8}
              align="center"
              justify="flex-end"
              style={{ width: '100%', maxWidth: 400 }}
            >
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('search', { defaultValue: 'Search' })}
                style={{ maxWidth: 232 }}
                suffix={<SearchOutlined />}
              />

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
            emptyText: (
              <Typography.Text>
                {t('emptyText', 'Labels can be created while updating or creating tasks.')}
              </Typography.Text>
            ),
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
    </>
  );
};

export default LabelsSettings;
