import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { closeReleaseViewer } from '@/features/whats-new/whatsNewSlice';
import WhatsNewReleaseModal from './WhatsNewReleaseModal';

// Opened from a notification-drawer click on a What's New row (see
// notfication-drawer.tsx's goToUrl). Closing this NEVER dismisses anything —
// it only clears isViewedModalOpen, so the nav tag's own dismissal state
// (user_release_dismissals) is untouched no matter how this is closed.
const WhatsNewReleaseViewerModal = () => {
  const dispatch = useAppDispatch();
  const { viewedRelease, isViewedModalOpen, viewedLoading, viewedNotFound } = useAppSelector(
    state => state.whatsNewReducer
  );

  if (!isViewedModalOpen) return null;

  return (
    <WhatsNewReleaseModal
      open={isViewedModalOpen}
      release={viewedRelease}
      loading={viewedLoading}
      notFound={viewedNotFound}
      onClose={() => dispatch(closeReleaseViewer())}
    />
  );
};

export default WhatsNewReleaseViewerModal;
