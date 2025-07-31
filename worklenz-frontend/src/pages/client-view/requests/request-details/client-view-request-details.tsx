import { Card, Descriptions, Flex, Tag, Typography, Timeline, Button } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { durationDateFormat } from '../../../../utils/durationDateFormat';
import ClientPortalStatusTags from '../../../../components/client-portal/ClientPortalStatusTags';

const ClientViewRequestDetails = () => {
  const { t } = useTranslation('client-view-requests');
  const { id } = useParams();
  const navigate = useNavigate();

  // Get request details from Redux (replace with API call)
  const requestDetails = useAppSelector((state) => 
    state.clientViewReducer.requestsReducer.requests.find((req: any) => req.id === id)
  );

  if (!requestDetails) {
    return (
      <Flex vertical gap={24} style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('requestNotFound')}
        </Typography.Title>
        <Button onClick={() => navigate('/client-portal/requests')}>
          {t('backToRequests')}
        </Button>
      </Flex>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'accepted': return 'blue';
      case 'in_progress': return 'processing';
      case 'completed': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between">
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('requestDetails')} - {requestDetails.req_no}
        </Typography.Title>
        <Button onClick={() => navigate('/client-portal/requests')}>
          {t('backToRequests')}
        </Button>
      </Flex>

      <Card>
        <Descriptions title={t('requestInformation')} bordered>
          <Descriptions.Item label={t('requestNumber')} span={2}>
            {requestDetails.req_no}
          </Descriptions.Item>
          <Descriptions.Item label={t('status')} span={1}>
            <ClientPortalStatusTags status={requestDetails.status} />
          </Descriptions.Item>
          <Descriptions.Item label={t('service')} span={3}>
            {requestDetails.service}
          </Descriptions.Item>
          <Descriptions.Item label={t('submittedOn')} span={3}>
            {durationDateFormat(requestDetails.time)}
          </Descriptions.Item>
          <Descriptions.Item label={t('description')} span={3}>
            {requestDetails.description || t('noDescription')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={t('requestTimeline')}>
        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <div>
                  <Typography.Text strong>{t('requestSubmitted')}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">
                    {durationDateFormat(requestDetails.time)}
                  </Typography.Text>
                </div>
              ),
            },
            {
              color: 'blue',
              children: (
                <div>
                  <Typography.Text strong>{t('requestUnderReview')}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">
                    {t('organizationReviewing')}
                  </Typography.Text>
                </div>
              ),
            },
            // Add more timeline items based on request status
          ]}
        />
      </Card>

      <Card title={t('attachments')}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Typography.Text type="secondary">
            {t('noAttachments')}
          </Typography.Text>
        </div>
      </Card>

      <Card title={t('notes')}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Typography.Text type="secondary">
            {t('noNotes')}
          </Typography.Text>
        </div>
      </Card>
    </Flex>
  );
};

export default ClientViewRequestDetails; 