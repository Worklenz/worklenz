import { Drawer, Typography, Input, Flex, Select, Table } from 'antd';
import React, { useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';

import { useTranslation } from 'react-i18next';
import TableColumns from '../project-list/table-columns';
import { addProjectToClient, toggleClientSettingsDrawer, updateClientName } from '../../features/clients-portal/clients/clients-slice';

const ClientPortalClientsSettingsDrawer = () => {
  const [projectSearchQuery, setProjectSearchQuery] = useState('');

  // localization
  const { t } = useTranslation('client-portal-clients');

  // get all projects from state
  const projectList = useAppSelector(
    (state) => state.projectsReducer.projects.data
  );

  // get drawer data from client reducer
  const {
    isClientSettingsDrawerOpen,
    selectedClient,
    clients: clientsList,
  } = useAppSelector((state) => state.clientsPortalReducer.clientsReducer);

  const dispatch = useAppDispatch();

  // find the selected client
  const selectedClientObj = clientsList.find(
    (client) => client.id === selectedClient
  );

  const [clientName, setClientName] = useState(selectedClientObj?.name || '');
  const [isEditing, setIsEditing] = useState(false);

  // handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientName(e.target.value);
  };

  // handle input blur or Enter press
  const handleNameSave = () => {
    if (clientName.trim() && selectedClientObj) {
      dispatch(
        updateClientName({ id: selectedClientObj.id, name: clientName })
      );
    }
    setIsEditing(false);
  };

  // handle project selection
  const handleProjectSelect = (projectId: string) => {
    if (selectedClientObj) {
      dispatch(
        addProjectToClient({ clientId: selectedClientObj.id, projectId })
      );
    }
  };

  return (
    <Drawer
      title={
        isEditing ? (
          <Input
            defaultValue={selectedClientObj?.name}
            onChange={handleNameChange}
            onBlur={handleNameSave}
            onPressEnter={handleNameSave}
            autoFocus
          />
        ) : (
          <Typography.Title
            level={2}
            style={{
              margin: 0,
              textTransform: 'capitalize',
              cursor: 'pointer',
            }}
            onClick={() => setIsEditing(true)}
          >
            {selectedClientObj?.name || 'Unnamed Client'}
          </Typography.Title>
        )
      }
      width={900}
      open={isClientSettingsDrawerOpen}
      onClose={() => dispatch(toggleClientSettingsDrawer(null))}
    >
      <Flex vertical gap={24}>
        <Flex vertical gap={8}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('assignProjectLabel') || 'Assign Project'}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('assignProjectDescription') || 'Select a project to assign to this client'}
          </Typography.Text>
          <Select
            showSearch
            value={null} // reset after selection
            onChange={handleProjectSelect}
            style={{ maxWidth: 400 }}
            placeholder="Select a project"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={projectList
              .filter(
                (proj) =>
                  !selectedClientObj?.projects.some(
                    (p) => p.id === proj.projectId
                  )
              ) // exclude already assigned projects
              .map((proj) => ({
                label: proj.projectName,
                value: proj.projectId,
              }))}
          />
        </Flex>

        <Table
          columns={TableColumns()}
          dataSource={selectedClientObj?.projects}
          className="custom-two-colors-row-table"
          rowClassName={() => 'custom-row'}
          scroll={{
            x: 1020,
          }}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
            pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
            size: 'small',
          }}
        />
      </Flex>
    </Drawer>
  );
};

export default ClientPortalClientsSettingsDrawer;
