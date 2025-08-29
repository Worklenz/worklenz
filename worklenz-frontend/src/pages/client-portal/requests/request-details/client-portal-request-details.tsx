import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import {
  Button,
  Card,
  Flex,
  Radio,
  Select,
  Tabs,
  TabsProps,
  Typography,
} from '@/shared/antd-imports';
import { ArrowLeftOutlined, DownOutlined } from '@ant-design/icons';
import { colors } from '../../../../styles/colors';
import { useNavigate } from 'react-router-dom';

const ClientPortalRequestDetails = () => {
  // localization
  const { t: t1 } = useTranslation('client-portal-requests');
  const { t: t2 } = useTranslation('client-portal-common');

  const { selectedRequestNo, requests } = useAppSelector(
    state => state.clientsPortalReducer.requestsReducer
  );

  const navigate = useNavigate();

  // filter the seleted request
  const selectedRequest = useMemo(() => {
    return requests.find((request: any) => request.req_no === selectedRequestNo);
  }, [requests, selectedRequestNo]);

  const items: TabsProps['items'] = [
    {
      key: 'submission',
      label: t1('submissionTab'),
      children: (
        <Flex vertical gap={24} style={{ height: 'calc(100vh - 400px)', overflowY: 'auto' }}>
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('projectTitle')}</Typography.Text>
            <Typography.Text>Animation video for worklenz</Typography.Text>
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('desiredLength')}</Typography.Text>
            <Typography.Text>5</Typography.Text>
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>
              {t1('preferredVideoStyle')}
            </Typography.Text>
            <Typography.Text>Animation</Typography.Text>
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('script')}</Typography.Text>
            <Typography.Text>Animation</Typography.Text>
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('voiceOver')}</Typography.Text>
            <Radio.Group
              name="radiogroup"
              defaultValue={'option1'}
              options={[
                { value: 'option1', label: t1('iWillProvide') },
                { value: 'option2', label: t1('needThatOneToo') },
              ]}
            />
          </Flex>
          <Flex vertical gap={8}>
            <Typography.Text style={{ fontWeight: 600 }}>{t1('samples')}</Typography.Text>
            <img
              src="https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcTNHXGJR2Nbpk5ntKmK7AXUjQXHNmPD2r1BZVj9ClQvMBpmzipx"
              alt="sample"
              style={{ width: 150, height: 150, objectFit: 'cover' }}
            />
          </Flex>
        </Flex>
      ),
    },
    {
      key: 'chat',
      label: t1('chatTab'),
      children: <div>chats</div>,
    },
  ];

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Flex gap={12} align="center">
          <Button
            icon={<ArrowLeftOutlined style={{ fontSize: 22 }} />}
            className="borderless-icon-btn"
            style={{ boxShadow: 'none' }}
            onClick={() => navigate('/worklenz/client-portal/requests')}
          />

          <Typography.Title level={5} style={{ marginBlock: 0 }}>
            {t1('reqNoText')}: {selectedRequest?.req_no}
          </Typography.Title>
        </Flex>

        <Select
          value={selectedRequest?.status}
          options={[
            { label: t2('pendingStatus'), value: 'pending' },
            { label: t2('inProgressStatus'), value: 'inProgress' },
            { label: t2('acceptedStatus'), value: 'accepted' },
          ]}
          onChange={value => console.log(value)}
          variant="borderless"
          labelRender={value => (
            <Typography.Text style={{ color: colors.skyBlue }}>{value.label}</Typography.Text>
          )}
          suffixIcon={<DownOutlined style={{ color: colors.skyBlue }} />}
        />
      </Flex>
      <Card style={{ height: 'cal(100vh - 330px)' }}>
        <Tabs
          defaultActiveKey="submission"
          items={items}
          style={{
            height: 'calc(100vh - 330px)',
            overflow: 'hidden',
          }}
        />
      </Card>
    </Flex>
  );
};

export default ClientPortalRequestDetails;
