import { ReactNode } from 'react';

interface CollapsibleProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  color?: string;
}

const Collapsible = ({ isOpen, children, className = '', color }: CollapsibleProps) => {
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        marginTop: '6px',
      }}
      className={`transition-all duration-300 ease-in-out ${
        isOpen
          ? 'max-h-[2000px] opacity-100 overflow-x-scroll'
          : 'max-h-0 opacity-0 overflow-hidden'
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default Collapsible;
