import { useState, type ReactNode } from 'react';

interface DeferredMountProps {
  isOpen: boolean;
  children: ReactNode;
}

/** Skip closed dialog setup on startup, then retain state and closing animations. */
export const DeferredMount = ({ isOpen, children }: DeferredMountProps) => {
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  return isOpen || hasOpened ? children : null;
};
