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
  Dropdown,
  CaretDownFilled,
  theme,
} from '@/shared/antd-imports';
import { useEffect, useMemo, useState } from 'react';

import PinRouteToNavbarButton from '@/components/PinRouteToNavbarButton';
import { useTranslation } from 'react-i18next';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
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
  const { t, i18n } = useTranslation('settings/labels');
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('pageTitle', 'Manage Labels'));
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [selectedLabel, setSelectedLabel] = useState<ITaskLabel | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [labels, setLabels] = useState<ITaskLabel[]>([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { token } = theme.useToken();

  const filteredData = useMemo(
    () =>
      labels.filter(record =>
        Object.values(record).some(value =>
          value?.toString().toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
    [labels, searchQuery]
  );

  const totalCount = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(currentPage => Math.min(currentPage, totalPages));
  }, [totalPages]);

  const paginatedData = useMemo(
    () =>
      filteredData.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
      ),
    [filteredData, safePage, pageSize]
  );

  const pageNumbers = useMemo(() => {
    const nums: (number | '…')[] = [];

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(
        p =>
          p === 1 ||
          p === totalPages ||
          Math.abs(p - safePage) <= 1
      );

    pages.forEach((p, i) => {
      if (i > 0 && p - (pages[i - 1] as number) > 1) {
        nums.push('…');
      }

      nums.push(p);
    });

    return nums;
  }, [totalPages, safePage]);

  // Pagination button styles
  const btnStyle = (active: boolean): React.CSSProperties => ({
    minWidth: 28,
    height: 28,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? token.colorPrimary : 'transparent',
    color: active ? token.colorTextLightSolid : token.colorText,
    transition: 'all .1s',
    padding: '0 4px',
  });

  const navBtnStyle = (enabled: boolean): React.CSSProperties => ({
    minWidth: 28,
    height: 28,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 5,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: enabled ? token.colorText : token.colorTextDisabled,
    transition: 'all .1s',
    padding: '0 4px',
  });

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

    const plural = !i18n.resolvedLanguage?.startsWith('it') && usageCount > 1 ? 's' : '';

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
    setSelectedLabel(null);
    setShowDrawer(true);
  };

  const handleEditClick = (record: ITaskLabel) => {
    setSelectedLabel(record);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    setSelectedLabel(null);
    setShowDrawer(false);
    getLabels();
  };

  // table columns
  const columns: TableProps<ITaskLabel>['columns'] = [
    {
      key: 'label',
      title: t('labelColumn', 'Label'),
      onCell: record => ({
        onClick: () => handleEditClick(record),
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
                  handleEditClick(record);
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
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('search', { defaultValue: 'Search' })}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />
            <Button type="primary" onClick={handleCreateClick}>
              {t('createLabelButton', { defaultValue: 'Create Label' })}
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
          emptyText: <Empty description={t('emptyText', { defaultValue: 'No labels found' })} />,
        }}
        loading={loading}
        className="custom-two-colors-row-table"
        dataSource={paginatedData}
        columns={columns}
        rowKey={record => record.id!}
        onRow={record => ({
          style: { cursor: 'pointer' },
          onClick: () => handleEditClick(record),
        })}
        pagination={false}
      />

      {/* Custom Pagination */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          padding: '10px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {/* Rows per page and count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              color: token.colorTextSecondary,
            }}
          >
            {t('rowsPerPage', { defaultValue: 'Rows per page' })}
          </span>

          <Dropdown
            trigger={['click']}
            menu={{
              items: [10, 20, 50, 100].map(n => ({
                key: String(n),
                label: String(n),
              })),
              selectedKeys: [String(pageSize)],
              onClick: info => {
                setPageSize(Number(info.key));
                setPage(1);
              },
            }}
          >
            <Button size="small">
              {pageSize} <CaretDownFilled />
            </Button>
          </Dropdown>

          <span
            style={{
              fontSize: 12,
              color: token.colorTextSecondary,
              marginLeft: 4,
            }}
          >
            {t('paginationSummary', {
              range:
                totalCount === 0
                  ? '0'
                  : `${(safePage - 1) * pageSize + 1} – ${Math.min(
                    safePage * pageSize,
                    totalCount
                  )}`,
              total: totalCount,
              defaultValue: '{{range}} of {{total}}',
            })}
          </span>
        </div>

        {/* Page navigation */}
        <nav
          aria-label={t('common:paginationNavigation')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            aria-label={t('common:firstPage')}
            style={navBtnStyle(safePage > 1)}
            disabled={safePage === 1}
            onClick={() => setPage(1)}
          >
            «
          </button>

          <button
            type="button"
            aria-label={t('common:previousPage')}
            style={navBtnStyle(safePage > 1)}
            disabled={safePage === 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
          >
            ‹
          </button>

          {pageNumbers.map((p, i) =>
            typeof p === 'number' ? (
              <button
                type="button"
                key={i}
                aria-current={p === safePage ? 'page' : undefined}
                style={btnStyle(p === safePage)}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ) : (
              <span
                key={i}
                aria-hidden="true"
                style={{
                  fontSize: 12,
                  padding: '0 4px',
                  opacity: 0.5,
                }}
              >
                …
              </span>
            )
          )}

          <button
            type="button"
            aria-label={t('common:nextPage')}
            style={navBtnStyle(safePage < totalPages)}
            disabled={safePage === totalPages}
            onClick={() =>
              setPage(p => Math.min(totalPages, p + 1))
            }
          >
            ›
          </button>

          <button
            type="button"
            aria-label={t('common:lastPage')}
            style={navBtnStyle(safePage < totalPages)}
            disabled={safePage === totalPages}
            onClick={() => setPage(totalPages)}
          >
            »
          </button>
        </nav>
      </div>

      <LabelsDrawer
        drawerOpen={showDrawer}
        selectedLabel={selectedLabel}
        drawerClosed={handleDrawerClose}
      />
    </Card>
  );
};

export default LabelsSettings;
