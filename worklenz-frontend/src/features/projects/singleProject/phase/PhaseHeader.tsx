import React from 'react';
import { useSelectedProject } from '../../../../hooks/useSelectedProject';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { Flex } from 'antd';
import ConfigPhaseButton from './ConfigPhaseButton';
import { colors } from '../../../../styles/colors';
import { useTranslation } from 'react-i18next';

const PhaseHeader = () => {
  // localization
  const { t } = useTranslation('task-list-filters');

  // get selected project for useSelectedProject hook
  const selectedProject = useSelectedProject();

  // get phase data from redux
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);

  //get phases details from phases slice
  const phase = phaseList.find(el => el.projectId === selectedProject?.projectId);

  return (
    <Flex align="center" justify="space-between">
      {phase?.phase || t('phasesText')}
      <ConfigPhaseButton color={colors.darkGray} />
    </Flex>
  );
};

export default PhaseHeader;
