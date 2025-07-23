import { setSelectOrDeselectBillable } from '@/features/reporting/time-reports/time-reports-overview.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { CaretDownFilled } from '@/shared/antd-imports';
import { Button, Checkbox, Dropdown, MenuProps } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';

const Billable: React.FC = () => {
  const { t } = useTranslation('time-report');
  const dispatch = useAppDispatch();

  const { billable } = useAppSelector(state => state.timeReportsOverviewReducer);

  // Dropdown items for the menu
  const menuItems: MenuProps['items'] = [
    {
      key: 'search',
      label: <Checkbox checked={billable.billable}>{t('billable')}</Checkbox>,
      onClick: () => {
        dispatch(setSelectOrDeselectBillable({ ...billable, billable: !billable.billable }));
      },
    },
    {
      key: 'selectAll',
      label: <Checkbox checked={billable.nonBillable}>{t('nonBillable')}</Checkbox>,
      onClick: () => {
        dispatch(setSelectOrDeselectBillable({ ...billable, nonBillable: !billable.nonBillable }));
      },
    },
  ];

  return (
    <div>
      <Dropdown
        menu={{ items: menuItems }}
        placement="bottomLeft"
        trigger={['click']}
        overlayStyle={{ maxHeight: '330px', overflowY: 'auto' }}
      >
        <Button>
          {t('billable')} <CaretDownFilled />
        </Button>
      </Dropdown>
    </div>
  );
};

export default Billable;
