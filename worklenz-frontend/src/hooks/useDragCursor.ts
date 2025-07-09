import { useEffect } from 'react';
import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect';

/**
 * Custom hook to handle cursor style changes during drag operations
 * @param isDragging - Boolean indicating if an item is being dragged
 */
const useDragCursor = (isDragging: boolean) => {
  useIsomorphicLayoutEffect(() => {
    if (!isDragging) return;

    // Save the original cursor style
    const originalCursor = document.body.style.cursor;

    // Apply grabbing cursor to the entire document when dragging
    document.body.style.cursor = 'grabbing';

    // Reset cursor when dragging stops or component unmounts
    return () => {
      document.body.style.cursor = originalCursor;
    };
  }, [isDragging]);
};

export default useDragCursor;
