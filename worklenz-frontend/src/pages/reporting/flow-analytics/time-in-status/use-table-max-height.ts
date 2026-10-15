import { useEffect, useState } from 'react';

const MIN_HEIGHT = 480;
// Top bar + content padding (52 + 48) plus a little breathing room below the card.
const PAGE_CHROME = 124;

const available = () => Math.max(MIN_HEIGHT, window.innerHeight - PAGE_CHROME);

/** Tallest the report table card may grow; shorter result sets make the card shrink to fit. */
export const useTableMaxHeight = (): number => {
  const [height, setHeight] = useState(available);
  useEffect(() => {
    const onResize = () => setHeight(available());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height;
};
