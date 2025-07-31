import { useLayoutEffect, useEffect } from 'react';

// Use useLayoutEffect in browser environments and useEffect in SSR environments
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default useIsomorphicLayoutEffect;
