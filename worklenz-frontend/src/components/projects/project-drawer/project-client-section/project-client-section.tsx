import { createClient, fetchClients } from '@/features/settings/client/clientSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IClientsViewModel } from '@/types/client.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { QuestionCircleOutlined } from '@/shared/antd-imports';
import {
  AutoComplete,
  Flex,
  Form,
  FormInstance,
  Spin,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { useState } from 'react';

interface ProjectClientSectionProps {
  clients: IClientsViewModel;
  form: FormInstance;
  t: TFunction;
  project: IProjectViewModel | null;
  loadingClients: boolean;
  disabled: boolean;
}

const ProjectClientSection = ({
  clients,
  form,
  t,
  project = null,
  loadingClients = false,
  disabled = false,
}: ProjectClientSectionProps) => {
  const dispatch = useAppDispatch();
  const [searchTerm, setSearchTerm] = useState<string>('');

  const clientOptions = [
    ...(clients.data?.map((client, index) => ({
      key: index,
      value: client.id,
      label: client.name,
    })) || []),
    ...(searchTerm && clients.data?.length === 0 && !loadingClients
      ? [
          {
            key: 'create',
            value: 'create',
            label: (
              <>
                + {t('add')} <Typography.Text strong>{searchTerm}</Typography.Text>{' '}
                {t('asClient').toLowerCase()}
              </>
            ),
          },
        ]
      : []),
  ];

  const handleClientSelect = async (value: string, option: any) => {
    if (option.key === 'create') {
      const res = await dispatch(createClient({ name: searchTerm })).unwrap();
      if (res.done) {
        setSearchTerm('');
        form.setFieldsValue({
          client_name: res.body.name,
          client_id: res.body.id,
        });
      }
      return;
    }
    form.setFieldsValue({
      client_name: option.label,
      client_id: option.value,
    });
  };

  const handleClientChange = (value: string) => {
    setSearchTerm(value);
    form.setFieldsValue({ client_name: value });
  };

  const handleClientSearch = (value: string): void => {
    if (value.length > 2) {
      dispatch(
        fetchClients({ index: 1, size: 5, field: null, order: null, search: value || null })
      );
      form.setFieldValue('client_name', value);
    }
  };

  return (
    <>
      <Form.Item name="client_id" hidden initialValue={''}>
        <input />
      </Form.Item>
      <Form.Item
        name="client_name"
        label={
          <Typography.Text>
            {t('client')}&nbsp;
            <Tooltip title={t('youCanManageClientsUnderSettings')}>
              <QuestionCircleOutlined />
            </Tooltip>
          </Typography.Text>
        }
      >
        <AutoComplete
          options={clientOptions}
          allowClear
          onSearch={handleClientSearch}
          onSelect={handleClientSelect}
          onChange={handleClientChange}
          placeholder={t('typeToSearchClients')}
          dropdownRender={menu => (
            <>
              {loadingClients && (
                <Flex justify="center" align="center" style={{ height: '100px' }}>
                  <Spin />
                </Flex>
              )}
              {menu}
            </>
          )}
          disabled={disabled}
        />
      </Form.Item>
    </>
  );
};

export default ProjectClientSection;
