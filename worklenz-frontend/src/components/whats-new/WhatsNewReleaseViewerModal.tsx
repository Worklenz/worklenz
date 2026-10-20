import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { closeReleaseViewer, dismissRelease } from '@/features/whats-new/whatsNewSlice';
import WhatsNewReleaseModal from './WhatsNewReleaseModal';

// Opened from a notification-drawer click on a What's New row (see
// notfication-drawer.tsx's goToUrl) and from Settings > Help's "Release notes"
// row. Closing it only dismisses when the slice flagged `viewedDismissOnClose`,
// which happens solely for a Help-opened release the nav tag is currently
// showing (mirroring the tag's own modal). The drawer flow never sets it, so
// closing a drawer-opened release still leaves user_release_dismissals
// untouched, and so does opening an older or already-dismissed release from Help.
const WhatsNewReleaseViewerModal = () => {
  const dispatch = useAppDispatch();
  const {
    viewedRelease,
    isViewedModalOpen,
    viewedLoading,
    viewedNotFound,
    viewedShowNewBadge,
    viewedDismissOnClose,
  } = useAppSelector(state => state.whatsNewReducer);

  if (!isViewedModalOpen) return null;

  const handleClose = () => {
    dispatch(closeReleaseViewer());
    if (viewedDismissOnClose && viewedRelease) {
      dispatch(dismissRelease(viewedRelease.id));
    }
  };

  return (
    <WhatsNewReleaseModal
      open={isViewedModalOpen}
      release={viewedRelease}
      loading={viewedLoading}
      notFound={viewedNotFound}
      showNewBadge={viewedShowNewBadge}
      onClose={handleClose}
    />
  );
};

export default WhatsNewReleaseViewerModal;
