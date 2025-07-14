import { useEffect } from 'react';

const HubSpot = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.id = 'hs-script-loader';
    script.async = true;
    script.defer = true;
    script.src = '//js.hs-scripts.com/22348300.js';
    document.body.appendChild(script);

    return () => {
      const existingScript = document.getElementById('hs-script-loader');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return null;
};

export default HubSpot;
