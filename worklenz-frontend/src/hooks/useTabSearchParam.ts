import { useSearchParams } from 'react-router-dom';
import { isListTabKey } from '@/features/projects/singleProject/saved-views/saved-view-config';

const useTabSearchParam = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const projectView = isListTabKey(tab) ? 'list' : 'kanban';

  return { tab, projectView };
};

export default useTabSearchParam;
