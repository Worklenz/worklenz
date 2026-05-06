import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ResetPasswordRedirect = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const user = searchParams.get('user');
    const hash = searchParams.get('hash');

    if (user && hash) {
      // Redirect to the new route format
      navigate(`/auth/verify-reset-email/${user}/${hash}`, { replace: true });
    } else {
      // If missing parameters, redirect to forgot password
      navigate('/auth/forgot-password', { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '16px',
        color: '#666',
      }}
    >
      Redirecting...
    </div>
  );
};

export default ResetPasswordRedirect;
