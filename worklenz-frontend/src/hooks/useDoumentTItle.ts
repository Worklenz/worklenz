import { useEffect } from 'react';

export const useDocumentTitle = (title: string) => {
  return useEffect(() => {
    document.title = `Worklenz | ${title}`;
  }, [title]);
};
