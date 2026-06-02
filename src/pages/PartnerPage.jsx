import { useState, useEffect } from 'react';
import partnerService from '../services/partnerService';
import styles from './PartnerPage.css';
import { useTranslation } from 'react-i18next';
const Icons = {
  Wallet: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),
  Users: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Copy: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  ),
  ArrowUpRight: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  ),
};

const PartnerPage = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [referralLink, setReferralLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    method: 'card',
    cardNumber: '',
    walletAddress: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, linkData] = await Promise.all([
          partnerService.getStats(),
          partnerService.getReferralLink(),
        ]);
        setStats(statsData);
        setReferralLink(linkData.referral_link);
      } catch (err) {
        console.error('Failed to load partner data:', err);
        showNotification(t('partner.notifications.load_error'), 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [t]);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      showNotification(t('partner.notifications.link_copied'), 'success');
    } catch {
      showNotification(t('partner.notifications.copy_error'), 'error');
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();

    const details =
      withdrawForm.method === 'card'
        ? { card_number: withdrawForm.cardNumber }
        : { wallet_address: withdrawForm.walletAddress };

    try {
      await partnerService.createWithdrawal({
        amount: parseFloat(withdrawForm.amount),
        method: withdrawForm.method,
        details,
      });
      showNotification(t('partner.notifications.withdraw_success'), 'success');
      setWithdrawForm({
        amount: '',
        method: 'card',
        cardNumber: '',
        walletAddress: '',
      });

      // Обновить баланс
      const updatedStats = await partnerService.getStats();
      setStats(updatedStats);
    } catch (err) {
      showNotification(
        err.message || t('partner.notifications.withdraw_error'),
        'error',
      );
    }
  };

  if (loading) {
    return <div className={styles.loading}>{t('partner.loading')}</div>;
  }

  if (!stats) {
    return <div className={styles.error}>{t('partner.error')}</div>;
  }

  return (
    <div className="partner-page">
      <div className="container">
        {/* Уведомления */}
        {notification && (
          <div className={`notification ${notification.type}`}>
            {notification.type === 'success' ? (
              <svg className="icon icon-sm" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg className="icon icon-sm" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {notification.message}
          </div>
        )}

        {/* Заголовок */}
        <header className="partner-header">
          <h1>{t('partner.header.title')}</h1>
          <p>{t('partner.header.subtitle')}</p>
        </header>

        {/* Статистика */}
        <div className="stats-grid">
          <div className="stat-card highlight">
            <div className="stat-icon">
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <div className="stat-title">{t('partner.stats.balance_title')}</div>
            <div className="stat-value">
              {stats?.balance_net?.toFixed(2) || '0.00'} ₽
            </div>
            <div className="stat-subtitle">
              {t('partner.stats.balance_note')}
            </div>
          </div>

          {[1, 2, 3].map((level) => (
            <div className="stat-card" key={level}>
              <div className="stat-icon">
                <Icons.Users />
              </div>
              <div className="stat-title">
                {t(`partner.stats.referrals_level_${level}_title`)}
              </div>
              <div className="stat-value">
                {stats?.[`referrals_level_${level}`] || 0}
              </div>
              <div className="stat-subtitle">
                {t(`partner.stats.referrals_level_${level}_rate`)}
              </div>
            </div>
          ))}
        </div>
        {/* Реферальная ссылка */}
        <section className="referral-section">
          <h3 className="section-title">
            <Icons.ArrowUpRight />
            {t('partner.referral.title')}
          </h3>
          <div className="link-input-wrapper">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="link-input"
            />
            <button onClick={copyLink} className="copy-btn">
              <Icons.Copy />
              {t('partner.referral.copy_button')}
            </button>
          </div>
          <p className="link-hint">{t('partner.referral.hint')}</p>
        </section>

        {/* Форма вывода */}
        <section className="withdraw-section">
          <h3 className="section-title">
            <Icons.Wallet />
            {t('partner.withdraw.title')}
          </h3>
          <form onSubmit={handleWithdraw} className="withdraw-form">
            <div className="form-group">
              <label className="form-label">
                {t('partner.withdraw.amount_label')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={stats?.balance_net || 0}
                value={withdrawForm.amount}
                onChange={(e) =>
                  setWithdrawForm({ ...withdrawForm, amount: e.target.value })
                }
                className="form-input"
                placeholder={t('partner.withdraw.amount_placeholder', {
                  max: stats?.balance_net?.toFixed(2) || '0.00',
                })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {t('partner.withdraw.method_label')}
              </label>
              <select
                value={withdrawForm.method}
                onChange={(e) =>
                  setWithdrawForm({
                    ...withdrawForm,
                    method: e.target.value,
                    cardNumber: '',
                    walletAddress: '',
                  })
                }
                className="form-select"
              >
                <option value="card">
                  {t('partner.withdraw.methods.card')}
                </option>
                <option value="crypto_usdt">
                  {t('partner.withdraw.methods.usdt')}
                </option>
                <option value="crypto_btc">
                  {t('partner.withdraw.methods.btc')}
                </option>
                <option value="crypto_eth">
                  {t('partner.withdraw.methods.eth')}
                </option>
              </select>
            </div>

            {withdrawForm.method === 'card' ? (
              <div className="form-group">
                <label className="form-label">
                  {t('partner.withdraw.card_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('partner.withdraw.card_placeholder')}
                  value={withdrawForm.cardNumber}
                  onChange={(e) =>
                    setWithdrawForm({
                      ...withdrawForm,
                      cardNumber: e.target.value,
                    })
                  }
                  className="form-input"
                  pattern="[0-9\s]{13,19}"
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">
                  {t('partner.withdraw.wallet_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('partner.withdraw.wallet_placeholder', {
                    crypto: withdrawForm.method
                      .replace('crypto_', '')
                      .toUpperCase(),
                  })}
                  value={withdrawForm.walletAddress}
                  onChange={(e) =>
                    setWithdrawForm({
                      ...withdrawForm,
                      walletAddress: e.target.value,
                    })
                  }
                  className="form-input"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={
                !withdrawForm.amount ||
                parseFloat(withdrawForm.amount) > (stats?.balance_net || 0)
              }
              className="submit-btn"
            >
              {t('partner.withdraw.submit_button')}
            </button>
            <p className="withdraw-hint">{t('partner.withdraw.hint')}</p>
          </form>
        </section>

        {/* Как это работает */}
        <section className="how-it-works-section">
          <h3>{t('partner.how_it_works.title')}</h3>
          <div className="levels-grid">
            {[
              { level: 1, rate: '7.5%', descKey: 'direct' },
              { level: 2, rate: '5.0%', descKey: 'second' },
              { level: 3, rate: '2.5%', descKey: 'third' },
            ].map(({ level, rate, descKey }) => (
              <div className="level-card" key={level}>
                <div className="level-badge">{level}</div>
                <div className="level-rate">{rate}</div>
                <div className="level-desc">
                  {t(`partner.how_it_works.levels.${descKey}`)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PartnerPage;
