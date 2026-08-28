import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Form,
  Row,
  Col,
  Divider,
  Typography,
  Alert,
  theme,
  message,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  useCreateClientMutation,
  useGetClientsQuery,
  clientPortalApi,
  CreateClientRequest,
} from '@/ee/api/client-portal/client-portal-api';
import { useGetProjectsByTeamQuery } from '@/api/home-page/home-page.api.service';
import PhoneInput from '@/components/PhoneInput/PhoneInput';
import { validatePhoneNumber } from '@/utils/validatePhoneNumber';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { showUpgradePrompt } from '@/features/admin-center/admin-center.slice';
import { useResponsive } from '@/hooks/useResponsive';
import dayjs from 'dayjs';
import HomeClientsTable from './HomeClientsTable';

const getCreateClientErrorMessage = (
  errorMessage: string,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const normalizedMessage = errorMessage.toLowerCase();

  if (
    normalizedMessage.includes('clients_name_team_id_uindex') ||
    (normalizedMessage.includes('duplicate key value') && normalizedMessage.includes('name'))
  ) {
    return t('clientNameAlreadyExistsError', {
      ns: 'client-portal-clients',
      defaultValue: 'A client with this name already exists. Use a different client name.',
    });
  }

  return (
    errorMessage ||
    t('createClientErrorMessage', {
      ns: 'client-portal-clients',
      defaultValue: 'Failed to create client',
    })
  );
};

const HomeAddClient: React.FC = () => {
  const { token } = theme.useToken();
  const { t } = useTranslation(['home', 'client-portal-clients']);
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const hasBusinessAccess = hasBusinessFeatureAccess(authService.getCurrentSession());
  const { isDesktop, isMobile } = useResponsive();
  const formRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  const [createClient, { isLoading }] = useCreateClientMutation();
  const { data: projectListData } = useGetProjectsByTeamQuery();
  const totalProjects = projectListData?.body?.length || 0;

  // Fetch the entire client list (not the table's own paginated slice) so the
  // stat cards reflect true totals rather than just the current table page.
  const { data: clientsData } = useGetClientsQuery({ page: 1, limit: 1000 });
  const clientList = useMemo(() => clientsData?.body?.clients || [], [clientsData]);
  const totalClients = clientsData?.body?.total || 0;
  const newThisMonth = useMemo(
    () => clientList.filter(c => c.created_at && dayjs(c.created_at).isSame(dayjs(), 'month')).length,
    [clientList]
  );
  const withoutContact = useMemo(
    () => clientList.filter(c => !c.contact_person?.trim()).length,
    [clientList]
  );

  const formValues = Form.useWatch([], form) || ({} as Partial<CreateClientRequest>);
  const canSubmit = useMemo(() => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((formValues.email || '').trim());
    return !!(
      formValues.name?.trim() &&
      emailValid &&
      formValues.company_name?.trim() &&
      formValues.contact_person?.trim()
    );
  }, [formValues]);

  const sectionDivider: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
  };
  const cardStyle: React.CSSProperties = {
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    padding: 18,
  };

  const handleCreate = async (values: CreateClientRequest) => {
    if (!hasBusinessAccess) {
      dispatch(
        showUpgradePrompt({
          title: t('addClient.upgradePromptTitle', { defaultValue: 'Clients' }),
          description: t('addClient.upgradePromptDescription', {
            defaultValue:
              'Give clients a branded portal to track project progress. Available on the Business plan.',
          }),
        })
      );
      return;
    }

    try {
      await createClient({
        name: values.name,
        email: values.email,
        company_name: values.company_name,
        contact_person: values.contact_person,
        phone: values.phone,
        phone_country_code: values.phone?.trim() ? values.phone_country_code : undefined,
        address_line_1: values.address_line_1,
        city: values.city,
        state: values.state,
        zip_code: values.zip_code,
        country: values.country,
      }).unwrap();

      message.success(
        t('createClientSuccessMessage', {
          ns: 'client-portal-clients',
          defaultValue:
            'Client created successfully! Share the organization invite link to give them portal access.',
        })
      );
      form.resetFields();
      dispatch(clientPortalApi.util.invalidateTags(['Clients']));
    } catch (error: any) {
      const errorMessage = error?.data?.message || error?.message || '';
      message.error(getCreateClientErrorMessage(errorMessage, t));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {t('addClient.pageTitle', { defaultValue: 'Add New Client' })}
        </h1>
        <p style={{ opacity: 0.5, fontSize: 13, margin: '4px 0 0' }}>
          {t('addClient.pageSubtitle', { defaultValue: 'Create a new client record quickly' })}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          gap: 18,
          alignItems: 'flex-start',
        }}
      >
        {/* LEFT: form */}
        <div
          ref={formRef}
          style={{
            ...cardStyle,
            flex: isDesktop ? '0 0 auto' : '1 1 auto',
            width: isDesktop ? 480 : '100%',
          }}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate} autoComplete="off">
            <Divider orientation="left" style={{ marginTop: 0, ...sectionDivider }}>
              <Typography.Text strong style={{ fontSize: 13 }}>
                {t('basicInformationSection', { ns: 'client-portal-clients', defaultValue: 'Basic Information' })}
              </Typography.Text>
            </Divider>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="name"
                  label={t('recordNameLabel', { ns: 'client-portal-clients', defaultValue: 'Record Name (Internal)' })}
                  rules={[
                    {
                      required: true,
                      message: t('recordNameRequired', {
                        ns: 'client-portal-clients',
                        defaultValue: 'Please enter an internal record name',
                      }),
                    },
                    {
                      min: 2,
                      message: t('recordNameMinLength', {
                        ns: 'client-portal-clients',
                        defaultValue: 'Record name must be at least 2 characters',
                      }),
                    },
                  ]}
                >
                  <Input
                    placeholder={t('recordNamePlaceholder', {
                      ns: 'client-portal-clients',
                      defaultValue: 'Enter internal record name',
                    })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="email"
                  label={t('emailLabel', { ns: 'client-portal-clients', defaultValue: 'Email Address' })}
                  rules={[
                    {
                      required: true,
                      message: t('emailRequired', {
                        ns: 'client-portal-clients',
                        defaultValue: 'Please enter email address',
                      }),
                    },
                    {
                      type: 'email',
                      message: t('emailInvalid', {
                        ns: 'client-portal-clients',
                        defaultValue: 'Please enter a valid email',
                      }),
                    },
                  ]}
                >
                  <Input
                    placeholder={t('emailPlaceholder', {
                      ns: 'client-portal-clients',
                      defaultValue: 'Enter email address',
                    })}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="company_name"
                  label={t('clientCompanyLabel', { ns: 'client-portal-clients', defaultValue: 'Client / Company' })}
                  rules={[
                    {
                      required: true,
                      message: t('clientCompanyRequired', {
                        ns: 'client-portal-clients',
                        defaultValue: 'Please enter the client company name',
                      }),
                    },
                  ]}
                >
                  <Input
                    placeholder={t('clientCompanyPlaceholder', {
                      ns: 'client-portal-clients',
                      defaultValue: 'Enter client company name',
                    })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="contact_person"
                  label={t('primaryContactLabel', { ns: 'client-portal-clients', defaultValue: 'Primary Contact (POC)' })}
                  rules={[
                    {
                      required: true,
                      message: t('primaryContactRequired', {
                        ns: 'client-portal-clients',
                        defaultValue: 'Please enter a primary contact person',
                      }),
                    },
                  ]}
                >
                  <Input
                    placeholder={t('primaryContactPlaceholder', {
                      ns: 'client-portal-clients',
                      defaultValue: 'Enter primary contact (POC) name',
                    })}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="phone"
                  label={t('phoneLabel', { ns: 'client-portal-clients', defaultValue: 'Phone Number' })}
                  rules={[
                    {
                      validator: (_, value) => {
                        if (!value || value.trim() === '') return Promise.resolve();
                        if (validatePhoneNumber(value)) return Promise.resolve();
                        return Promise.reject(
                          new Error(
                            t('phoneInvalid', {
                              ns: 'client-portal-clients',
                              defaultValue: 'Please enter a valid phone number',
                            })
                          )
                        );
                      },
                    },
                  ]}
                >
                  <PhoneInput
                    placeholder={t('phonePlaceholder', { ns: 'client-portal-clients', defaultValue: 'Enter phone number' })}
                  />
                </Form.Item>
                <Form.Item name="phone_country_code" hidden>
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">
              <Typography.Text strong style={{ fontSize: 13 }}>
                {t('contactInformationSection', { ns: 'client-portal-clients', defaultValue: 'Contact Information' })}
              </Typography.Text>
            </Divider>

            <Form.Item
              name="address_line_1"
              label={t('addressLine1Label', { ns: 'client-portal-clients', defaultValue: 'Street Address' })}
            >
              <Input
                placeholder={t('addressLine1Placeholder', {
                  ns: 'client-portal-clients',
                  defaultValue: 'Enter street address (optional)',
                })}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="city" label={t('cityLabel', { ns: 'client-portal-clients', defaultValue: 'City' })}>
                  <Input placeholder={t('cityPlaceholder', { ns: 'client-portal-clients', defaultValue: 'City' })} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="state"
                  label={t('stateLabel', { ns: 'client-portal-clients', defaultValue: 'State / Province' })}
                >
                  <Input
                    placeholder={t('statePlaceholder', {
                      ns: 'client-portal-clients',
                      defaultValue: 'State / Province',
                    })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="zip_code"
                  label={t('zipCodeLabel', { ns: 'client-portal-clients', defaultValue: 'Zip / Postal Code' })}
                >
                  <Input placeholder={t('zipCodePlaceholder', { ns: 'client-portal-clients', defaultValue: 'Zip code' })} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="country" label={t('countryLabel', { ns: 'client-portal-clients', defaultValue: 'Country' })}>
              <Input placeholder={t('countryPlaceholder', { ns: 'client-portal-clients', defaultValue: 'Country' })} />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              message={
                <Typography.Text style={{ fontSize: 12 }}>
                  {t('clientInvitationEmailInfo', {
                    ns: 'client-portal-clients',
                    defaultValue:
                      'An invitation email will be sent to the client to join the portal once portal invites are enabled.',
                  })}
                </Typography.Text>
              }
              style={{ marginTop: 4 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Button onClick={() => form.resetFields()}>
                {t('cancelButton', { ns: 'client-portal-clients', defaultValue: 'Cancel' })}
              </Button>
              <Button type="primary" htmlType="submit" loading={isLoading} disabled={!canSubmit || isLoading}>
                {t('createButton', { ns: 'client-portal-clients', defaultValue: 'Create Client' })}
              </Button>
            </div>
          </Form>
        </div>

        {/* RIGHT: stat cards + client table */}
        <div style={{ flex: '1 1 0', minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {[
              {
                label: t('totalClientsLabel', { ns: 'client-portal-clients', defaultValue: 'Total Clients' }),
                value: totalClients,
                color: '#1677ff',
              },
              {
                label: t('totalProjectsLabel', { ns: 'client-portal-clients', defaultValue: 'Total Projects' }),
                value: totalProjects,
                color: '#722ed1',
              },
              {
                label: t('addClient.newThisMonthLabel', { defaultValue: 'New This Month' }),
                value: newThisMonth,
                color: '#52c41a',
              },
              {
                label: t('addClient.missingContactLabel', { defaultValue: 'Missing Contact' }),
                value: withoutContact,
                color: '#faad14',
              },
            ].map(s => (
              <div key={s.label} style={cardStyle}>
                <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <HomeClientsTable onCreateClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        </div>
      </div>
    </div>
  );
};

export default HomeAddClient;
