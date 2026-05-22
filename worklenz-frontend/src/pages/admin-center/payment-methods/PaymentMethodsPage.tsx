import React from 'react';
import WorklenzPageHeader from '@/components/common/WorklenzPageHeader';
import SavedCards from '@/components/admin-center/billing/saved-cards/SavedCards';

const PaymentMethodsPage: React.FC = () => {
  return (
    <div style={{ width: '100%' }}>
      <WorklenzPageHeader title="Payment Methods" style={{ padding: '16px 0' }} />
      <SavedCards />
    </div>
  );
};

export default PaymentMethodsPage;
