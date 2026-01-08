import { TFunction } from 'i18next';
import { Badge, Form, FormInstance, Select, Typography, Flex, Tooltip } from '@/shared/antd-imports';
import { CrownOutlined } from '@ant-design/icons';

import { IProjectHealth } from '@/types/project/projectHealth.types';
import { useAuthService } from '@/hooks/useAuth';
import { shouldRestrictProjectHealth } from '@/utils/subscription-utils';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

interface ProjectHealthSectionProps {
  healths: IProjectHealth[];
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const ProjectHealthSection = ({ healths, form, t, disabled }: ProjectHealthSectionProps) => {
  const { t: tCommon } = useTranslation('common');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isRestricted = shouldRestrictProjectHealth(currentSession);
  const dispatch = useAppDispatch();

  const healthOptions = healths.map((status, index) => ({
    key: index,
    value: status.id,
    label: (
      <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Badge color={status.color_code} /> {status.name}
      </Typography.Text>
    ),
  }));

  const handleSelectClick = () => {
    if (isRestricted) {
      dispatch(toggleUpgradeModal());
    }
  };

  return (
    <Form.Item name="health_id" label={
      <Flex align="center" gap={4}>
        <span>{t('health')}</span>
        {isRestricted && (
          <Tooltip title={tCommon('upgrade-plan')} placement="top">
            <CrownOutlined 
              style={{ fontSize: '14px', color: '#faad14', cursor: 'pointer' }}
              onClick={handleSelectClick}
            />
          </Tooltip>
        )}
      </Flex>
    }>
      <Select
        options={healthOptions}
        onChange={value => form.setFieldValue('health_id', value)}
        disabled={disabled || isRestricted}
        onClick={handleSelectClick}
      />
    </Form.Item>
  );
};

export default ProjectHealthSection;
