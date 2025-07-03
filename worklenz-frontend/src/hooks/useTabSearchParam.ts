import { useSearchParams } from 'react-router-dom';

const useTabSearchParam = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const projectView = tab === 'tasks-list' ? 'list' : 'kanban';

  return { tab, projectView };
};

export default useTabSearchParam;
