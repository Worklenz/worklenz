import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

/** Account moved into Settings: old links and bookmarks land on the matching section. */
const SECTION_FOR_TAB: Record<string, string> = {
  notifications: 'notifications',
  profile: 'profile',
};

export const AccountPage: React.FC = () => {
  const { tab } = useParams();
  return <Navigate to={`/settings/${(tab && SECTION_FOR_TAB[tab]) || 'organization'}`} replace />;
};

export default AccountPage;
