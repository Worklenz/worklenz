import {
  DoubleLeftOutlined,
  ExclamationOutlined,
  Flex,
  Form,
  FormInstance,
  MinusOutlined,
  PauseOutlined,
  Select,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { TFunction } from 'i18next';

import { IProjectPrioritiesGetResponse } from '@/types/project/projectPriority.types';
import { useAppSelector } from '@/hooks/useAppSelector';

import './project-priority-section.css';

interface ProjectPrioritySectionProps {
  priorities: IProjectPrioritiesGetResponse[];
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const ProjectPrioritySection = ({ priorities, form, t, disabled }: ProjectPrioritySectionProps) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const selectedPriorityId = Form.useWatch('priority_id', form);
  const { token } = theme.useToken();

  const getPriorityColor = (priority: IProjectPrioritiesGetResponse) => {
    const color = themeMode === 'dark' ? priority.color_code_dark : priority.color_code;
    return color || priority.color_code || priority.color_code_dark || token.colorTextTertiary;
  };

  const renderPriorityIcon = (priorityName: string) => {
    const normalizedPriorityName = priorityName.toLowerCase();
    const iconStyle = { color: token.colorTextTertiary };

    if (normalizedPriorityName === 'low') {
      return <MinusOutlined style={iconStyle} aria-hidden />;
    }

    if (normalizedPriorityName === 'medium') {
      return <PauseOutlined style={{ ...iconStyle, transform: 'rotate(90deg)' }} aria-hidden />;
    }

    if (normalizedPriorityName === 'high') {
      return (
        <DoubleLeftOutlined style={{ ...iconStyle, transform: 'rotate(90deg)' }} aria-hidden />
      );
    }

    if (normalizedPriorityName === 'critical') {
      return <ExclamationOutlined style={iconStyle} aria-hidden />;
    }

    return <span className="project-priority-section__icon-placeholder" aria-hidden />;
  };

  const renderPriorityLabel = (priority: IProjectPrioritiesGetResponse, isCurrent = false) => {
    const color = getPriorityColor(priority);

    return (
      <Flex
        align="center"
        justify="space-between"
        gap={12}
        className="project-priority-section__row"
      >
        <Flex align="center" gap={8} className="project-priority-section__content">
          <span className="project-priority-section__icon">
            {renderPriorityIcon(priority.name)}
          </span>
          <span
            className="project-priority-section__color-dot"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <Typography.Text className="project-priority-section__name">
            {priority.name}
          </Typography.Text>
        </Flex>
        {isCurrent && (
          <Typography.Text
            className="project-priority-section__current"
            style={{ color: token.colorPrimary }}
          >
            <span
              className="project-priority-section__current-dot"
              style={{ backgroundColor: token.colorPrimary }}
              aria-hidden
            />
            {t('current', { defaultValue: 'Current' })}
          </Typography.Text>
        )}
      </Flex>
    );
  };

  const selectedPriority = priorities.find(priority => priority.id === selectedPriorityId);
  const priorityOptions = priorities.map(priority => ({
    key: priority.id,
    value: priority.id,
    label: renderPriorityLabel(priority, priority.id === selectedPriorityId),
  }));

  return (
    <Form.Item name="priority_id" label={t('priority', { defaultValue: 'Priority' })}>
      <Select
        className="project-priority-section__select"
        popupClassName="project-priority-section__popup"
        options={priorityOptions}
        onChange={value => form.setFieldValue('priority_id', value)}
        placeholder={t('selectPriority', { defaultValue: 'Select priority' })}
        disabled={disabled}
        labelRender={() =>
          selectedPriority ? (
            renderPriorityLabel(selectedPriority)
          ) : (
            <Typography.Text type="secondary">
              {t('selectPriority', { defaultValue: 'Select priority' })}
            </Typography.Text>
          )
        }
      />
    </Form.Item>
  );
};

export default ProjectPrioritySection;
