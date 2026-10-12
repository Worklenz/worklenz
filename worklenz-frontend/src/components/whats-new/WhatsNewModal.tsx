import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { closeWhatsNewModal, dismissRelease } from '@/features/whats-new/whatsNewSlice';
import WhatsNewReleaseModal from './WhatsNewReleaseModal';

const WhatsNewModal = () => {
  const dispatch = useAppDispatch();
  const { currentRelease, isModalOpen } = useAppSelector(state => state.whatsNewReducer);

  if (!currentRelease) return null;

  const handleClose = () => {
    dispatch(closeWhatsNewModal());
    dispatch(dismissRelease(currentRelease.id));
  };

  return <WhatsNewReleaseModal open={isModalOpen} release={currentRelease} onClose={handleClose} />;
};

export default WhatsNewModal;
