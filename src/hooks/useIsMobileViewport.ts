import { useState, useEffect } from 'react';

const isMobileCheck = () =>
  window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

export const useIsMobileViewport = () => {
  const [isMobile, setIsMobile] = useState(isMobileCheck);
  useEffect(() => {
    const touchMq = window.matchMedia('(pointer: coarse)');
    const update = () => setIsMobile(isMobileCheck());
    window.addEventListener('resize', update);
    touchMq.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      touchMq.removeEventListener('change', update);
    };
  }, []);
  return isMobile;
};
