import { useCallback, useRef, useState } from 'react';

/** Tracks the actual scroll element, including replacement after a loading state. */
export const useTaskListScrollContainer = () => {
  const outerScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const attachScrollContainer = useCallback((element: HTMLDivElement | null) => {
    outerScrollRef.current = element;
    setScrollContainer(element);
  }, []);

  return { outerScrollRef, scrollContainer, attachScrollContainer };
};
