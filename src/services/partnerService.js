import api from './api';

const partnerService = {
  getStats: async () => {
    const response = await api.get('/partner/stats');
    return response.data;
  },
  getReferralLink: async (origin = window.location.origin) => {
    const response = await api.get('/partner/link', {
      params: { origin },
    });
    return response.data;
  },

  createWithdrawal: async ({ amount, method, details }) => {
    const response = await api.post('/partner/withdraw', {
      amount,
      method,
      details,
    });
    return response.data;
  },

  getTransactions: async (params = {}) => {
    const response = await api.get('/partner/transactions', {
      params: {
        limit: 20,
        offset: 0,
        ...params,
      },
    });
    return response.data;
  },

  getReferrals: async (params = {}) => {
    const response = await api.get('/partner/referrals', {
      params,
    });
    return response.data;
  },

  trackReferralClick: async (refCode, sessionId) => {
    const API_BASE_URL =
      import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

    await fetch(`${API_BASE_URL}/partner/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref_code: refCode, session_id: sessionId }),
      mode: 'cors',
    }).catch(() => {
      // Ошибки трекинга не должны ломать основной функционал
      console.warn('Failed to track referral click');
    });
  },
};

export default partnerService;
