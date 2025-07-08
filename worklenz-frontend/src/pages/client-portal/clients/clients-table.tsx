import {
    DeleteOutlined,
    ExclamationCircleFilled,
    SettingOutlined,
    ShareAltOutlined,
  } from '@ant-design/icons';
  import {
    Button,
    Card,
    Flex,
    Popconfirm,
    Table,
    Tooltip,
    Typography,
  } from 'antd';
  import { TableProps } from 'antd/lib';
  import React from 'react';
  import { useTranslation } from 'react-i18next';
  import { colors } from '../../../styles/colors';
  import { useAppSelector } from '../../../hooks/useAppSelector';
  import {
    deleteClient,
    toggleClientSettingsDrawer,
    toggleClientTeamsDrawer,
  } from '../../../features/clients-portal/clients/clients-slice';
  import { useAppDispatch } from '../../../hooks/useAppDispatch';
  import { TempClientPortalClientType } from '../../../types/client-portal/temp-client-portal.types';
  
  const ClientsTable = () => {
    // localization
    const { t } = useTranslation('client-portal-clients');
  
    //   get clients list from clients reducer
    const clientsList: TempClientPortalClientType[] = useAppSelector(
      (state) => state.clientsPortalReducer.clientsReducer.clients
    );
  
    const dispatch = useAppDispatch();
  
    // table columns
    const columns: TableProps['columns'] = [
      {
        key: 'client',
        title: t('clientColumn'),
        render: (record) => (
          <Typography.Text style={{ textTransform: 'capitalize' }}>
            {record.name}
          </Typography.Text>
        ),
        onCell: () => ({
          style: { minWidth: 320 },
        }),
      },
      {
        key: 'assignedProjects',
        title: t('assignedProjectsColumn'),
        render: (record) => (
          <Typography.Text>{record.assigned_projects_count}</Typography.Text>
        ),
        width: 240,
      },
      {
        key: 'actionBtns',
        title: t('actionBtnsColumn'),
        width: 240,
        render: (record) => (
          <Flex gap={12} align="center">
            <Tooltip title={t('settingsTooltip')}>
              <Button
                shape="default"
                icon={<SettingOutlined />}
                size="small"
                onClick={() => dispatch(toggleClientSettingsDrawer(record.id))}
              />
            </Tooltip>
  
            <Tooltip title={t('shareTooltip')}>
              <Button
                shape="default"
                icon={<ShareAltOutlined />}
                size="small"
                onClick={() => {
                  dispatch(toggleClientTeamsDrawer(record.id));
                }}
              />
            </Tooltip>
  
            <Popconfirm
              title={t('deleteConfirmationTitle')}
              icon={
                <ExclamationCircleFilled
                  style={{ color: colors.vibrantOrange }}
                />
              }
              okText={t('deleteConfirmationOk')}
              cancelText={t('deleteConfirmationCancel')}
              onConfirm={() => dispatch(deleteClient(record.id))}
            >
              <Tooltip title={t('deleteTooltip')}>
                <Button shape="default" icon={<DeleteOutlined />} size="small" />
              </Tooltip>
            </Popconfirm>
          </Flex>
        ),
      },
    ];
  
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Table
          columns={columns}
          dataSource={clientsList}
          pagination={{
            size: 'small',
          }}
          scroll={{
            x: 'max-content',
          }}
        />
      </Card>
    );
  };
  
  export default ClientsTable;
  