import {
  Button,
  Drawer,
  Form,
  Input,
  message,
  Typography,
  Flex,
  Dropdown,
} from '@/shared/antd-imports';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';

const WorklenzColorShades = {
  '#154c9b': [
    '#0D2A50',
    '#112E54',
    '#153258',
    '#19365C',
    '#1D3A60',
    '#213E64',
    '#254268',
    '#29466C',
    '#2D4A70',
    '#314E74',
  ],
  '#3b7ad4': [
    '#224884',
    '#26528A',
    '#2A5C90',
    '#2E6696',
    '#32709C',
    '#367AA2',
    '#3A84A8',
    '#3E8EAE',
    '#4298B4',
    '#46A2BA',
  ],
  '#70a6f3': [
    '#3D5D8A',
    '#46679E',
    '#5071B2',
    '#597BC6',
    '#6385DA',
    '#6C8FEE',
    '#7699F2',
    '#7FA3F6',
    '#89ADFA',
    '#92B7FE',
  ],
  '#7781ca': [
    '#42486F',
    '#4C5283',
    '#565C97',
    '#6066AB',
    '#6A70BF',
    '#747AD3',
    '#7E84E7',
    '#888EFB',
    '#9298FF',
    '#9CA2FF',
  ],
  '#9877ca': [
    '#542D70',
    '#6E3A8A',
    '#8847A4',
    '#A254BE',
    '#BC61D8',
    '#D66EF2',
    '#E07BFC',
    '#EA88FF',
    '#F495FF',
    '#FEA2FF',
  ],
  '#c178c9': [
    '#6A2E6F',
    '#843B89',
    '#9E48A3',
    '#B855BD',
    '#D262D7',
    '#EC6FF1',
    '#F67CFB',
    '#FF89FF',
    '#FF96FF',
    '#FFA3FF',
  ],
  '#ee87c5': [
    '#832C6A',
    '#9D3984',
    '#B7469E',
    '#D153B8',
    '#EB60D2',
    '#FF6DEC',
    '#FF7AF6',
    '#FF87FF',
    '#FF94FF',
    '#FFA1FF',
  ],
  '#ca7881': [
    '#6F2C3E',
    '#893958',
    '#A34672',
    '#BD538C',
    '#D760A6',
    '#F16DC0',
    '#FB7ADA',
    '#FF87F4',
    '#FF94FF',
    '#FFA1FF',
  ],
  '#75c9c0': [
    '#3F6B66',
    '#497E7A',
    '#53918E',
    '#5DA4A2',
    '#67B7B6',
    '#71CBCA',
    '#7BDEDE',
    '#85F2F2',
    '#8FFFFF',
    '#99FFFF',
  ],
  '#75c997': [
    '#3F6B54',
    '#497E6A',
    '#53917F',
    '#5DA495',
    '#67B7AA',
    '#71CBBF',
    '#7BDED4',
    '#85F2E9',
    '#8FFFFF',
    '#99FFFF',
  ],
  '#80ca79': [
    '#456F3E',
    '#5A804D',
    '#6F935C',
    '#84A66B',
    '#99B97A',
    '#AECC89',
    '#C3DF98',
    '#D8F2A7',
    '#EDFFB6',
    '#FFFFC5',
  ],
  '#aacb78': [
    '#5F6F3E',
    '#7A804D',
    '#94935C',
    '#AFA66B',
    '#CAB97A',
    '#E5CC89',
    '#FFDF98',
    '#FFF2A7',
    '#FFFFB6',
    '#FFFFC5',
  ],
  '#cbbc78': [
    '#6F5D3E',
    '#8A704D',
    '#A4835C',
    '#BF966B',
    '#DAA97A',
    '#F5BC89',
    '#FFCF98',
    '#FFE2A7',
    '#FFF5B6',
    '#FFFFC5',
  ],
  '#cb9878': [
    '#704D3E',
    '#8B604D',
    '#A6735C',
    '#C1866B',
    '#DC997A',
    '#F7AC89',
    '#FFBF98',
    '#FFD2A7',
    '#FFE5B6',
    '#FFF8C5',
  ],
  '#bb774c': [
    '#653D27',
    '#80502C',
    '#9B6331',
    '#B67636',
    '#D1893B',
    '#EC9C40',
    '#FFAF45',
    '#FFC24A',
    '#FFD54F',
    '#FFE854',
  ],
  '#905b39': [
    '#4D2F1A',
    '#623C23',
    '#774A2C',
    '#8C5735',
    '#A1643E',
    '#B67147',
    '#CB7E50',
    '#E08B59',
    '#F59862',
    '#FFA56B',
  ],
  '#903737': [
    '#4D1A1A',
    '#622323',
    '#772C2C',
    '#8C3535',
    '#A13E3E',
    '#B64747',
    '#CB5050',
    '#E05959',
    '#F56262',
    '#FF6B6B',
  ],
  '#bf4949': [
    '#661212',
    '#801B1B',
    '#992424',
    '#B32D2D',
    '#CC3636',
    '#E63F3F',
    '#FF4848',
    '#FF5151',
    '#FF5A5A',
    '#FF6363',
  ],
  '#f37070': [
    '#853A3A',
    '#A04D4D',
    '#BA6060',
    '#D47373',
    '#EF8686',
    '#FF9999',
    '#FFA3A3',
    '#FFACAC',
    '#FFB6B6',
    '#FFBFBF',
  ],
  '#ff9c3c': [
    '#8F5614',
    '#AA6F1F',
    '#C48829',
    '#DFA233',
    '#F9BB3D',
    '#FFC04E',
    '#FFC75F',
    '#FFCE70',
    '#FFD581',
    '#FFDB92',
  ],
  '#fbc84c': [
    '#8F6D14',
    '#AA862F',
    '#C4A029',
    '#DFB933',
    '#F9D23D',
    '#FFD74E',
    '#FFDC5F',
    '#FFE170',
    '#FFE681',
    '#FFEB92',
  ],
  '#cbc8a1': [
    '#6F6D58',
    '#8A886F',
    '#A4A286',
    '#BFBC9D',
    '#DAD6B4',
    '#F5F0CB',
    '#FFFEDE',
    '#FFFFF2',
    '#FFFFCD',
    '#FFFFCD',
  ],
  '#a9a9a9': [
    '#5D5D5D',
    '#757575',
    '#8D8D8D',
    '#A5A5A5',
    '#BDBDBD',
    '#D5D5D5',
    '#EDEDED',
    '#F5F5F5',
    '#FFFFFF',
    '#FFFFFF',
  ],
  '#767676': [
    '#404040',
    '#4D4D4D',
    '#5A5A5A',
    '#676767',
    '#747474',
    '#818181',
    '#8E8E8E',
    '#9B9B9B',
    '#A8A8A8',
    '#B5B5B5',
  ],
} as const;

// Flatten the color shades into a single array for the color picker
const WorklenzColorCodes = Object.values(WorklenzColorShades).flat();

type LabelsDrawerProps = {
  drawerOpen: boolean;
  labelId: string | null;
  drawerClosed: () => void;
};

const LabelsDrawer = ({ drawerOpen = false, labelId = null, drawerClosed }: LabelsDrawerProps) => {
  const { t } = useTranslation('settings/labels');
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  useEffect(() => {
    if (labelId) {
      getLabelById(labelId);
    } else {
      form.resetFields();
      form.setFieldsValue({ color_code: Object.keys(WorklenzColorShades)[0] }); // Set default color
    }
  }, [labelId, form]);

  const getLabelById = async (id: string) => {
    try {
      const response = await labelsApiService.getLabels();
      if (response.done) {
        const label = response.body.find((l: any) => l.id === id);
        if (label) {
          form.setFieldsValue({
            name: label.name,
            color_code: label.color_code,
          });
        }
      }
    } catch (error) {
      message.error(t('fetchLabelErrorMessage', 'Failed to fetch label'));
    }
  };

  const handleFormSubmit = async (values: { name: string; color_code: string }) => {
    try {
      if (labelId) {
        const response = await labelsApiService.updateLabel(labelId, {
          name: values.name,
          color: values.color_code,
        });
        if (response.done) {
          message.success(t('updateLabelSuccessMessage', 'Label updated successfully'));
          drawerClosed();
        }
      } else {
        // For creating new labels, we'd need a create API endpoint
        message.info(t('createNotSupported', 'Creating new labels is done through tasks'));
        drawerClosed();
      }
    } catch (error) {
      message.error(
        labelId
          ? t('updateLabelErrorMessage', 'Failed to update label')
          : t('createLabelErrorMessage', 'Failed to create label')
      );
    }
  };

  const handleClose = () => {
    form.resetFields();
    drawerClosed();
  };

  const ColorPicker = ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (color: string) => void;
  }) => (
    <Dropdown
      dropdownRender={() => (
        <div
          style={{
            padding: 16,
            backgroundColor: token.colorBgElevated,
            borderRadius: token.borderRadius,
            boxShadow: token.boxShadowSecondary,
            border: `1px solid ${token.colorBorder}`,
            width: 400,
            maxHeight: 500,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: 6,
              justifyItems: 'center',
            }}
          >
            {WorklenzColorCodes.map(color => (
              <div
                key={color}
                style={{
                  width: 18,
                  height: 18,
                  backgroundColor: color,
                  borderRadius: 2,
                  border:
                    value === color
                      ? `2px solid ${token.colorPrimary}`
                      : `1px solid ${token.colorBorder}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
                onClick={() => onChange?.(color)}
                onMouseEnter={e => {
                  if (value !== color) {
                    e.currentTarget.style.transform = 'scale(1.2)';
                    e.currentTarget.style.boxShadow = token.boxShadow;
                    e.currentTarget.style.zIndex = '10';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.zIndex = '1';
                }}
              />
            ))}
          </div>
        </div>
      )}
      trigger={['click']}
    >
      <div
        style={{
          width: 40,
          height: 40,
          backgroundColor: value || Object.keys(WorklenzColorShades)[0],
          borderRadius: 4,
          border: `1px solid ${token.colorBorder}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = token.boxShadow;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </Dropdown>
  );

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {labelId
            ? t('updateLabelDrawerTitle', 'Edit Label')
            : t('createLabelDrawerTitle', 'Create Label')}
        </Typography.Text>
      }
      open={drawerOpen}
      onClose={handleClose}
      destroyOnClose
      width={400}
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          name="name"
          label={t('nameLabel', 'Name')}
          rules={[
            {
              required: true,
              message: t('nameRequiredMessage', 'Please enter a label name'),
            },
          ]}
        >
          <Input placeholder={t('namePlaceholder', 'Enter label name')} />
        </Form.Item>

        <Form.Item
          name="color_code"
          label={t('colorLabel', 'Color')}
          rules={[
            {
              required: true,
              message: t('colorRequiredMessage', 'Please select a color'),
            },
          ]}
        >
          <ColorPicker />
        </Form.Item>

        <Flex justify="end" gap={8}>
          <Button onClick={handleClose}>{t('cancelButton', 'Cancel')}</Button>
          <Button type="primary" htmlType="submit">
            {labelId ? t('updateButton', 'Update') : t('createButton', 'Create')}
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
};

export default LabelsDrawer;
