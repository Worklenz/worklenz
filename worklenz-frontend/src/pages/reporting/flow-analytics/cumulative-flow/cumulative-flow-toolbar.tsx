import { memo } from 'react';
import { Flex } from '@/shared/antd-imports';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import type { FilterOption } from '../time-in-status/time-in-status-multi-select-filter';
import CumulativeFlowFilterPanel from './cumulative-flow-filter-panel';
import type { CumulativeFlowFilters } from './use-cumulative-flow-filters';

interface CumulativeFlowToolbarProps {
  filters: CumulativeFlowFilters;
  stageOptions: FilterOption[];
  isLoadingStages: boolean;
  onFiltersChange: (patch: Partial<CumulativeFlowFilters>) => void;
  onFiltersReset: () => void;
}

/** Same date range and Filter controls as the Time in Status report. */
const CumulativeFlowToolbar = ({
  filters,
  stageOptions,
  isLoadingStages,
  onFiltersChange,
  onFiltersReset,
}: CumulativeFlowToolbarProps) => (
  <Flex gap={8} wrap="wrap" align="center" justify="end">
    <TimeWiseFilter isPrimary />
    <CumulativeFlowFilterPanel
      filters={filters}
      stageOptions={stageOptions}
      isLoadingStages={isLoadingStages}
      onChange={onFiltersChange}
      onReset={onFiltersReset}
    />
  </Flex>
);

export default memo(CumulativeFlowToolbar);
