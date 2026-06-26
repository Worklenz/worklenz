import { useEffect } from 'react';

// Add TypeScript declarations for Tawk_API
declare global {
  interface Window {
    Tawk_API?: any;
    Tawk_LoadStart?: Date;
  }
}

interface TawkToProps {
  propertyId: string;
  widgetId: string;
}

const TawkTo: React.FC<TawkToProps> = ({ propertyId, widgetId }) => {
  useEffect(() => {
    // Initialize tawk.to chat
    const s1 = document.createElement('script');
    s1.async = true;
    s1.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    s1.setAttribute('crossorigin', '*');

    const s0 = document.getElementsByTagName('script')[0];
    s0.parentNode?.insertBefore(s1, s0);

    return () => {
      // Clean up when the component unmounts
      // Remove the script tag
      const tawkScript = document.querySelector(`script[src*="tawk.to/${propertyId}"]`);
      if (tawkScript && tawkScript.parentNode) {
        tawkScript.parentNode.removeChild(tawkScript);
      }

      // Remove the tawk.to iframe
      const tawkIframe = document.getElementById('tawk-iframe');
      if (tawkIframe) {
        tawkIframe.remove();
      }

      // Reset Tawk globals
      delete window.Tawk_API;
      delete window.Tawk_LoadStart;
    };
  }, [propertyId, widgetId]);

  return null;
};

export default TawkTo;
