import { useLocation } from 'react-router-dom';

/** Shows the current URL so a test can assert where the app navigated. */
export const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};
