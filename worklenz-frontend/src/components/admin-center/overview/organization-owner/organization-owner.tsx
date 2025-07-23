import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IOrganization } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { MailOutlined, PhoneOutlined, EditOutlined } from '@/shared/antd-imports';
import { Card, Tooltip, Input, Button, Typography, InputRef } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';

interface OrganizationOwnerProps {
  themeMode: string;
  organization: IOrganization | null;
  t: TFunction;
  refetch: () => void;
}

const OrganizationOwner = ({ themeMode, organization, t, refetch }: OrganizationOwnerProps) => {
  const [isEditableContactNumber, setIsEditableContactNumber] = useState(false);
  const [number, setNumber] = useState(organization?.contact_number || '');
  const contactNoRef = useRef<InputRef>(null);

  const handleContactNumberBlur = () => {
    setIsEditableContactNumber(false);
    updateOrganizationContactNumber();
  };

  const updateOrganizationContactNumber = async () => {
    try {
      const res = await adminCenterApiService.updateOwnerContactNumber({ contact_number: number });
      if (res.done) {
        refetch();
      }
    } catch (error) {
      logger.error('Error updating organization contact number:', error);
    }
  };

  const addContactNumber = () => {
    setIsEditableContactNumber(true);
    setTimeout(() => {
      contactNoRef.current?.focus();
    }, 500);
  };

  const handleEditContactNumber = () => {
    setIsEditableContactNumber(true);
  };

  const handleContactNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setNumber(inputValue);
  };

  return (
    <Card>
      <Typography.Title level={5} style={{ margin: 0, marginBottom: '0.5rem' }}>
        {t('owner')}
      </Typography.Title>
      <div style={{ paddingTop: '8px' }}>
        <div style={{ marginBottom: '8px' }}>
          <Typography.Text
            style={{
              color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
            }}
          >
            {organization?.owner_name || ''}
          </Typography.Text>
        </div>
      </div>
      <Typography.Paragraph style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
        <Typography.Text
          style={{
            color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
          }}
        >
          <span style={{ marginRight: '8px' }}>
            <Tooltip title="Email Address">
              <MailOutlined />
            </Tooltip>
          </span>
          {organization?.email || ''}
        </Typography.Text>
      </Typography.Paragraph>
      <Typography.Paragraph style={{ marginTop: '0.5rem', marginBottom: 0 }}>
        <Tooltip title="Contact Number">
          <span style={{ marginRight: '8px' }}>
            <PhoneOutlined />
          </span>
        </Tooltip>
        {isEditableContactNumber ? (
          <Input
            onChange={handleContactNumber}
            onPressEnter={handleContactNumberBlur}
            onBlur={handleContactNumberBlur}
            style={{ width: '200px' }}
            value={number}
            type="text"
            maxLength={15}
            ref={contactNoRef}
          />
        ) : number === '' ? (
          <Typography.Link onClick={addContactNumber}>{t('contactNumber')}</Typography.Link>
        ) : (
          <Typography.Text>
            {number}
            <Tooltip title="Edit">
              <Button
                onClick={handleEditContactNumber}
                size="small"
                type="link"
                icon={<EditOutlined />}
              />
            </Tooltip>
          </Typography.Text>
        )}
      </Typography.Paragraph>
    </Card>
  );
};

export default OrganizationOwner;
