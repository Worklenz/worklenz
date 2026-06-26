import { SettingOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleDrawer } from './phases.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';

const ConfigPhaseButton = () => {
  // get theme details from redux
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // localization
  const { t } = useTranslation('task-list-filters');

  const dispatch = useAppDispatch();

  return (
    <Tooltip title={t('configPhaseButtonTooltip')}>
      <Button
        className="borderless-icon-btn"
        style={{ backgroundColor: colors.transparent, boxShadow: 'none' }}
        onClick={() => dispatch(toggleDrawer())}
        icon={<SettingOutlined style={{ color: themeMode === 'dark' ? colors.white : 'black' }} />}
      />
    </Tooltip>
  );
};

export default ConfigPhaseButton;
