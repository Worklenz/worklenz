import { useState } from 'react';
import { Button } from '@/shared/antd-imports';
import { EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { CreateProjectModal } from '@/components/projects/create-project-modal/create-project-modal';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_projects_create_click } from '@/shared/worklenz-analytics-events';

interface CreateProjectButtonProps {
  className?: string;
  style?: React.CSSProperties;
}

const CreateProjectButton: React.FC<CreateProjectButtonProps> = ({ className, style }) => {
  const { t } = useTranslation('create-first-project-form');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpen = () => {
    trackMixpanelEvent(evt_projects_create_click);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  return (
    <div className={className}>
      <Button type="primary" icon={<EditOutlined />} onClick={handleOpen} style={style}>
        {t('createProject', { defaultValue: 'Create Project' })}
      </Button>

      <CreateProjectModal open={isModalOpen} onClose={handleClose} />
    </div>
  );
};

export default CreateProjectButton;
