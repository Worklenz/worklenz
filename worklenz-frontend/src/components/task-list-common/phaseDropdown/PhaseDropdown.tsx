import { Badge, Flex, Select, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';
// custom css file
import './phaseDropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { PhaseOption } from '../../../types/phase.types';
import { colors } from '../../../styles/colors';
import { useTranslation } from 'react-i18next';

const PhaseDropdown = ({ projectId }: { projectId: string }) => {
  const [currentPhaseOption, setCurrentPhaseOption] = useState<PhaseOption | null>(null);

  // localization
  const { t } = useTranslation('task-list-table');

  // get phase data from redux
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);

  //get phases details from phases slice
  const phase = phaseList.find(el => el.projectId === projectId);

  const handlePhaseOptionSelect = (value: string) => {
    const selectedOption = phase?.phaseOptions.find(option => option.optionId === value);
    if (selectedOption) {
      setCurrentPhaseOption(selectedOption);
    }
  };

  return (
    <Select
      value={currentPhaseOption?.optionId}
      placeholder={
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('selectText')}
        </Typography.Text>
      }
      onChange={handlePhaseOptionSelect}
      style={{
        width: 'fit-content',
        minWidth: 120,
      }}
      dropdownStyle={{
        padding: 0,
      }}
      variant={'borderless'}
    >
      {phase?.phaseOptions.map(option => (
        <Select.Option key={option.optionId} value={option.optionId}>
          <Flex gap={4} align="center">
            <Badge color={option.optionColor} />
            <Typography.Text
              style={{
                fontSize: 13,
                color: colors.darkGray,
              }}
            >
              {option.optionName}
            </Typography.Text>
          </Flex>
        </Select.Option>
      ))}
    </Select>
  );
};

export default PhaseDropdown;
