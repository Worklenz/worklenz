import type { ReactNode } from 'react';
import { Modal } from '@/shared/antd-imports';
import { useResponsive } from '@/hooks/useResponsive';

interface DetailModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** One record (an approval, a change request) in a dialog over its list. Full-screen on phones; the body scrolls. */
export const DetailModal = ({ open, title, onClose, children }: DetailModalProps) => {
  const { isMobile } = useResponsive();
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      title={title}
      width={isMobile ? '100%' : 1000}
      style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0, paddingBottom: 0 } : { top: 40 }}
      styles={{ body: { maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' } }}
    >
      {children}
    </Modal>
  );
};
