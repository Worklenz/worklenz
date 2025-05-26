import { Alert } from 'antd';
import { useState, useEffect } from 'react';

interface ConditionalAlertProps {
  message?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  showInitially?: boolean;
  onClose?: () => void;
  condition?: boolean;
  className?: string;
}

const ConditionalAlert = ({
  message = '',
  type = 'info',
  showInitially = false,
  onClose,
  condition,
  className = ''
}: ConditionalAlertProps) => {
  const [visible, setVisible] = useState(showInitially);

  useEffect(() => {
    if (condition !== undefined) {
      setVisible(condition);
    }
  }, [condition]);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const alertStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    margin: 0,
    borderRadius: 0,
  } as const;

  if (!visible || !message) {
    return null;
  }

  return (
    <Alert
      message={message}
      type={type}
      closable
      onClose={handleClose}
      style={alertStyles}
      showIcon
      className={className}
    />
  );
};

export default ConditionalAlert; 