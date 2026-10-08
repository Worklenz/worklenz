import { SettingOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleDrawer } from './phases.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { getSoftwareProjectLabels, isSoftwareProjectType } from '@/lib/project/software-project';

const ConfigPhaseButton = () => {
  // get theme details from redux
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { project } = useAppSelector(state => state.projectReducer);
  const softwareLabels = getSoftwareProjectLabels(project?.project_type);

  // localization
  const { t } = useTranslation('task-list-filters');

  const dispatch = useAppDispatch();

  const tooltip = isSoftwareProjectType(project?.project_type)
    ? softwareLabels.managePhases
    : t('configPhaseButtonTooltip', { defaultValue: 'Manage phases' });

  return (
    <Tooltip title={tooltip}>
      <Button
        className="borderless-icon-btn"
        style={{ backgroundColor: colors.transparent, boxShadow: 'none' }}
        onClick={() => dispatch(toggleDrawer())}
        icon={<SettingOutlined style={{ color: themeMode === 'dark' ? colors.white : 'black' }} />}
        aria-label={softwareLabels.managePhases}
      />
    </Tooltip>
  );
};

export default ConfigPhaseButton;
