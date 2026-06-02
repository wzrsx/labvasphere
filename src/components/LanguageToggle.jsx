import { useTranslation } from 'react-i18next';

const LanguageToggle = () => {
  const { i18n, t } = useTranslation();

  const toggle = () => {
    const next = i18n.language === 'en' ? 'ru' : 'en';
    i18n.changeLanguage(next);
  };

  return (
    <button type="button" onClick={toggle} className="lang-button">
      {t('lang_btn')}
    </button>
  );
};

export default LanguageToggle;
