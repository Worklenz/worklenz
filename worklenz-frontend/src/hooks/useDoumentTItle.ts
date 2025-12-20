import { useEffect } from 'react';
import { getBrandName } from '@/utils/branding';

export const useDocumentTitle = (title: string) => {
  return useEffect(() => {
    document.title = `${getBrandName()} | ${title}`;
  }, [title]);
};
