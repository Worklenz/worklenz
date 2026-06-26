import { useState, useEffect, useRef } from 'react';

/**
 * Hook to reactively read a column's width from CSS custom properties
 * Watches for changes to document.documentElement.style and re-reads the value
 * Optimized with debouncing for smoother resize performance
 * 
 * @param columnId - The column ID (e.g., 'labels')
 * @returns The current width in pixels as a number
 */
export const useColumnWidth = (columnId: string): number => {
  const [width, setWidth] = useState<number>(() => {
    const cssVar = getComputedStyle(document.documentElement)
      .getPropertyValue(`--col-width-${columnId}`)
      .trim();
    return parseCssWidth(cssVar);
  });

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const updateWidth = () => {
      const cssVar = getComputedStyle(document.documentElement)
        .getPropertyValue(`--col-width-${columnId}`)
        .trim();
      const newWidth = parseCssWidth(cssVar);
      setWidth(newWidth);
    };

    // Use requestAnimationFrame for smoother updates during resize
    const handleStyleChange = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updateWidth);
    };

    // Create a MutationObserver to watch for style attribute changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          handleStyleChange();
        }
      }
    });

    // Observe the document.documentElement for style attribute changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [columnId]);

  return width;
};

/**
 * Parse CSS width value to number (pixels)
 * @param cssValue - CSS value like "160px" or "10rem"
 * @returns Width in pixels
 */
function parseCssWidth(cssValue: string): number {
  if (!cssValue) return 160; // Default fallback

  // Handle px values
  if (cssValue.endsWith('px')) {
    return parseInt(cssValue.replace('px', ''), 10) || 160;
  }

  // Handle other units by creating a temporary element
  const temp = document.createElement('div');
  temp.style.width = cssValue;
  temp.style.position = 'absolute';
  temp.style.visibility = 'hidden';
  document.body.appendChild(temp);
  const width = temp.offsetWidth;
  document.body.removeChild(temp);

  return width || 160;
}
