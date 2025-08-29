import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import logger from '@/utils/errorLogger';
import { EnterOutlined, EditOutlined } from '@/shared/antd-imports';
import { Card, Button, Tooltip, Typography, TextArea } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { useState, useEffect } from 'react';

interface OrganizationNameProps {
  themeMode: string;
  name: string;
  t: TFunction;
  refetch: () => void;
}

const OrganizationName = ({ themeMode, name, t, refetch }: OrganizationNameProps) => {
  const [isEditable, setIsEditable] = useState(false);
  const [newName, setNewName] = useState(name);

  useEffect(() => {
    setNewName(name);
  }, [name]);

  const handleBlur = () => {
    if (newName.trim() === '') {
      setNewName(name);
      setIsEditable(false);
      return;
    }
    if (newName !== name) {
      updateOrganizationName();
    }
    setIsEditable(false);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewName(e.target.value);
  };

  const updateOrganizationName = async () => {
    try {
      const trimmedName = newName.trim();
      const res = await adminCenterApiService.updateOrganizationName({ name: trimmedName });
      if (res.done) {
        refetch();
      }
    } catch (error) {
      logger.error('Error updating organization name', error);
      setNewName(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setNewName(name);
      setIsEditable(false);
    }
  };

  return (
    <Card>
      <Typography.Title level={5} style={{ margin: 0, marginBottom: '0.5rem' }}>
        {t('name')}
      </Typography.Title>
      <div style={{ paddingTop: '8px' }}>
        <div style={{ marginBottom: '8px' }}>
          {isEditable ? (
            <div style={{ position: 'relative' }}>
              <TextArea
                style={{
                  height: '32px',
                  paddingRight: '40px',
                  resize: 'none',
                  borderRadius: '4px',
                }}
                onPressEnter={handleBlur}
                value={newName}
                onChange={handleNameChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                maxLength={100}
                placeholder={t('enterOrganizationName')}
              />
              <Button
                icon={<EnterOutlined style={{ color: '#1890ff' }} />}
                type="text"
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '4px 8px',
                  color: '#1890ff',
                }}
                onClick={handleBlur}
              />
            </div>
          ) : (
            <Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {name}
                <Tooltip title={t('edit')}>
                  <Button
                    onClick={() => setIsEditable(true)}
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    style={{ padding: '4px', color: '#1890ff' }}
                  />
                </Tooltip>
              </div>
            </Typography.Text>
          )}
        </div>
      </div>
    </Card>
  );
};

export default OrganizationName;
