import React from 'react';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { Flex } from '@/shared/antd-imports';
import ConfigPhaseButton from './ConfigPhaseButton';
import { colors } from '../../../../styles/colors';
import { useTranslation } from 'react-i18next';

const PhaseHeader = () => {
  // localization
  const { t } = useTranslation('task-list-filters');

  // get project data from redux
  const { project } = useAppSelector(state => state.projectReducer);

  return (
    <Flex align="center" justify="space-between">
      {project?.phase_label || t('phasesText')}
      <ConfigPhaseButton />
    </Flex>
  );
};

export default PhaseHeader;
