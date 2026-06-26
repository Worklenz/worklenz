import { useEffect, useState, useCallback, useMemo } from 'react';
import { useToggleFavoriteProjectMutation } from '@/api/projects/projects.v1.api.service';
import { colors } from '@/styles/colors';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { StarFilled } from '@/shared/antd-imports';
import { Button, ConfigProvider, Tooltip } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

export const ProjectRateCell: React.FC<{
  record: IProjectViewModel;
  t: TFunction;
}> = ({ record, t }) => {
  const [toggleFavoriteProject] = useToggleFavoriteProjectMutation();

  // Local optimistic state
  const [isFavorite, setIsFavorite] = useState(record.favorite);

  // When RTK Query re-fetches after cache invalidation, record.favorite
  // will have the fresh server value — sync it into local state here.
  useEffect(() => {
    setIsFavorite(record.favorite);
  }, [record.favorite]);

  const handleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!record.id) return;

      // Optimistic update for instant visual feedback
      setIsFavorite(prev => !prev);

      try {
        await toggleFavoriteProject(record.id).unwrap();
        // No manual refetch needed.
        // toggleFavoriteProject invalidates { type: 'Projects', id: 'LIST' }
        // in the API service, which automatically re-fetches ALL filter
        // variants of getProjects (filter=0 "All", filter=1 "Favorites", etc.)
        // so the star stays correct after navigating between pages.
      } catch {
        // Roll back optimistic update on API failure
        setIsFavorite(record.favorite);
      }
    },
    [record.id, record.favorite, toggleFavoriteProject]
  );

  const starColor = useMemo(() => (isFavorite ? colors.yellow : colors.lightGray), [isFavorite]);

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <Tooltip
        title={
          isFavorite
            ? t('removeFromFavorites', 'Remove from favorites')
            : t('addToFavorites', 'Add to favourites')
        }
      >
        <Button
          type="text"
          className="borderless-icon-btn"
          style={{
            backgroundColor: colors.transparent,
            width: 28,
            minWidth: 28,
            paddingInline: 0,
          }}
          shape="circle"
          icon={<StarFilled style={{ color: starColor, fontSize: '20px' }} />}
          onClick={handleFavorite}
        />
      </Tooltip>
    </ConfigProvider>
  );
};
