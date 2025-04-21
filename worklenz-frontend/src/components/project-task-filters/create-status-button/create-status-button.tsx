import { SettingOutlined } from '@ant-design/icons';
import Tooltip from 'antd/es/tooltip';
import Button from 'antd/es/button';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleDrawer } from '../../../features/projects/status/StatusSlice';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';

const CreateStatusButton = () => {
  const { t } = useTranslation('task-list-filters');

  const dispatch = useAppDispatch();

  return (
    <Tooltip title={t('createStatusButtonTooltip')}>
      <Button
        className="borderless-icon-btn"
        style={{ backgroundColor: colors.transparent, boxShadow: 'none' }}
        onClick={() => dispatch(toggleDrawer())}
        icon={
          <SettingOutlined
            style={{
              color: colors.skyBlue,
            }}
          />
        }
      />
    </Tooltip>
  );
};

export default CreateStatusButton;
