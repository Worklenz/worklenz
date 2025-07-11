import { redirect } from 'react-router-dom';
import { store } from '../store';
import { verifyAuthentication } from '@/features/auth/authSlice';

export const authLoader = async () => {
  const session = await store.dispatch(verifyAuthentication()).unwrap();

  if (!session.user) {
    return redirect('/auth/login');
  }

  if (session.user.is_expired) {
    return redirect('/worklenz/license-expired');
  }

  return session;
};
