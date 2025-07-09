import { useEffect, useState } from 'react';
import {
  useGetProjectsQuery,
  useToggleFavoriteProjectMutation,
} from '@/api/projects/projects.v1.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { StarFilled } from '@ant-design/icons';
import { Button, ConfigProvider, Tooltip } from 'antd';
import { TFunction } from 'i18next';
import { useCallback, useMemo } from 'react';

export const ProjectRateCell: React.FC<{
  record: IProjectViewModel;
  t: TFunction;
}> = ({ record, t }) => {
  const dispatch = useAppDispatch();
  const [toggleFavoriteProject] = useToggleFavoriteProjectMutation();
  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const { refetch: refetchProjects } = useGetProjectsQuery(requestParams);

  const [isFavorite, setIsFavorite] = useState(record.favorite);

  const handleFavorite = useCallback(async () => {
    if (record.id) {
      setIsFavorite(prev => !prev);
      await toggleFavoriteProject(record.id);
      // refetchProjects();
    }
  }, [dispatch, record.id]);

  const checkIconColor = useMemo(
    () => (isFavorite ? colors.yellow : colors.lightGray),
    [isFavorite]
  );

  useEffect(() => {
    setIsFavorite(record.favorite);
  }, [record.favorite]);

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <Tooltip title={record.favorite ? 'Remove from favorites' : 'Add to favourites'}>
        <Button
          type="text"
          className="borderless-icon-btn"
          style={{ backgroundColor: colors.transparent }}
          shape="circle"
          icon={<StarFilled style={{ color: checkIconColor, fontSize: '20px' }} />}
          onClick={e => {
            e.stopPropagation();
            handleFavorite();
          }}
        />
      </Tooltip>
    </ConfigProvider>
  );
};
