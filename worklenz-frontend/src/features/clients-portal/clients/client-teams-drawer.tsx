import {
    Button,
    Drawer,
    Flex,
    Input,
    message,
    Popconfirm,
    Table,
    Tooltip,
    Typography,
  } from 'antd';
  import { useAppSelector } from '../../../hooks/useAppSelector';
  import { useAppDispatch } from '../../../hooks/useAppDispatch';
  import { useTranslation } from 'react-i18next';
  import {
    deleteClientTeamMember,
    toggleClientTeamsDrawer,
  } from './clients-slice';
  import {
    CopyOutlined,
    DeleteOutlined,
    ExclamationCircleFilled,
  } from '@ant-design/icons';
  import { TableProps } from 'antd/lib';
  import { colors } from '../../../styles/colors';
  import CustomAvatar from '../../../components/CustomAvatar';
  
  const ClientTeamsDrawer = () => {
    // localization
    const { t } = useTranslation('client-portal-clients');
  
    // get drawer state from client reducer
    const {
      isClientTeamsDrawerOpen,
      selectedClient,
      clients: clientsList,
    } = useAppSelector((state) => state.clientsPortalReducer.clientsReducer);
    const dispatch = useAppDispatch();
  
    //   find the selected client
    const selectedClientObj = clientsList.find(
      (client) => client.id === selectedClient
    );
  
    // function to copy link to clipboard
    const copyLinkToClipboard = () => {
      const link = 'https://app.worklenz.com/worklenz/projects/10889d';
      navigator.clipboard.writeText(link);
      message.success(t('linkCopiedMessage'));
    };
  
    // table columns
    const columns: TableProps['columns'] = [
      {
        key: 'name',
        title: t('nameColumn'),
        render: (record) => (
          <Flex gap={8} align="center">
            <CustomAvatar avatarName={record.name} size={26} />
            <Typography.Text style={{ textTransform: 'capitalize' }}>
              {record.name}
            </Typography.Text>
          </Flex>
        ),
      },
      {
        key: 'actionBtns',
        title: t('actionBtnsColumn'),
        render: (record) => (
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={
              <ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />
            }
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={() =>
              dispatch(
                deleteClientTeamMember({
                  clientId: selectedClientObj?.id || '',
                  clientTeamMemberId: record.id,
                })
              )
            }
          >
            <Tooltip title={t('deleteTooltip')}>
              <Button shape="default" icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        ),
      },
    ];
  
    return (
      <Drawer
        title={
          <Typography.Text
            style={{ fontWeight: 500, fontSize: 16, textTransform: 'capitalize' }}
          >
            {selectedClientObj?.name}
          </Typography.Text>
        }
        open={isClientTeamsDrawerOpen}
        onClose={() => dispatch(toggleClientTeamsDrawer(null))}
      >
        <Flex vertical gap={32}>
          <Flex vertical gap={8}>
            <Typography.Text>{t('copyLinkLabel')}</Typography.Text>
            <Flex gap={4}>
              <Input
                disabled
                style={{ width: '100%' }}
                value={'https://app.worklenz.com/worklenz/projects/10889d'}
              />
              <Button
                type="default"
                icon={<CopyOutlined />}
                onClick={copyLinkToClipboard}
              />
            </Flex>
          </Flex>
  
          <Flex vertical gap={8}>
            <Typography.Text>{t('addTeamMembersLabel')}</Typography.Text>
            <Input placeholder={t('emailPlaceholder')} />
          </Flex>
  
          <Flex vertical gap={8}>
            <Typography.Text>{t('teamMembersLabel')}</Typography.Text>
            <Table
              dataSource={selectedClientObj?.team_members}
              columns={columns}
              pagination={false}
            />
          </Flex>
        </Flex>
      </Drawer>
    );
  };
  
  export default ClientTeamsDrawer;
  