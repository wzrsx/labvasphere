// src/components/ReferralHandler.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ReferralHandler = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');

    if (ref) {
      // Валидация UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(ref)) {
        console.log('🔗 Referral detected:', ref);
        localStorage.setItem('pending_ref', ref);
        localStorage.setItem('referral_click_time', new Date().toISOString());
    }
    }
  }, [location.search]);

  return null; 
};

export default ReferralHandler;