import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './GuidePage.css';

const ExpandableStep = ({ id, number, title, description, screenshot, screenshotAlt, isOpen, onStepClick }) => {
  return (
    <div id={`step-${id}`} className={`step-item expandable ${isOpen ? 'open' : ''}`}>
      <div className="step-header" onClick={onStepClick}>
        <span className="step-number">{number}</span>
        <div className="step-content">
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <span className={`step-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && screenshot && (
        <div className="step-screenshot">
          <img src={screenshot} alt={screenshotAlt} loading="lazy" />
        </div>
      )}
    </div>
  );
};

export const GuidePage = () => {
    const { t } = useTranslation();

const [activeTab, setActiveTab] = useState('prepare');
  const [openStepId, setOpenStepId] = useState(null);
  const timeoutRef = useRef(null); 

 const handleStepClick = (stepId, isCurrentlyOpen) => {
  // Функция плавного скролла с учётом шапки
  const scrollToElement = (id, offset = 10) => {
    const element = document.getElementById(`step-${id}`);
    if (!element) return;

    // 1. Ждём 1 кадр, чтобы браузер пересчитал макет после клика
    requestAnimationFrame(() => {
      // 2. Получаем координаты элемента относительно окна
      const rect = element.getBoundingClientRect();
      // 3. Текущая прокрутка страницы
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      // 4. Целевая позиция: текущий скролл + позиция элемента - отступ под шапку
      const targetPosition = scrollTop + rect.top - offset;

      // 5. Скроллим
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    });
  };

  // Сначала скроллим (всегда)
  scrollToElement(stepId);

  // Если клик по уже открытому — просто скролл, ничего не меняем
  if (isCurrentlyOpen) {
    return;
  }

  // Если клик по новому — открываем его (старые не закрываем)
  setOpenStepId(stepId);
};
 const tabs = [
    { id: 'prepare', label: t('guide.tabs.prepare') },
    { id: 'upload', label: t('guide.tabs.upload') },
    { id: 'view', label: t('guide.tabs.view') },
    { id: 'share', label: t('guide.tabs.share') },
    { id: 'faq', label: t('guide.tabs.faq') },
  ];
  
  const renderContent = () => {
    switch (activeTab) {
      case 'prepare':
        return (
          <section className="guide-section">
            <h2>{t('guide.prepare.title')}</h2>
            <div className="steps-list">
              <div className="step-item">
                <span className="step-number">1</span>
                <div>
                  <strong>{t('guide.prepare.step1.title')}</strong>
                  <p>{t('guide.prepare.step1.desc')}</p>
                </div>
              </div>
              <div className="step-item">
                <span className="step-number">2</span>
                <div>
                  <strong>{t('guide.prepare.step2.title')}</strong>
                  <p>{t('guide.prepare.step2.desc')}</p>
                </div>
              </div>
              <div className="step-item">
                <span className="step-number">3</span>
                <div>
                  <strong>{t('guide.prepare.step3.title')}</strong>
                  <p>{t('guide.prepare.step3.desc')}</p>
                </div>
              </div>
            </div>
            <div className="tip-box">
            {t('guide.prepare.tip.icon')} <strong>{t('guide.prepare.tip.label')}</strong> {t('guide.prepare.tip.text')}            </div>
          </section>
        );

      case 'upload':
        return (
          <section className="guide-section">
            <h2>{t('guide.upload.title')}</h2>
            <div className="steps-list">
              <ExpandableStep 
                id={`${activeTab}-1`}  
                number="1"
                title={t('guide.upload.step1.title')}
                description={t('guide.upload.step1.desc')}                
                screenshot="/screenshots-guide/upload-step1.png"
                screenshotAlt="Создание нового проекта"
                isOpen={openStepId === `${activeTab}-1`}
                onStepClick={() => handleStepClick(`${activeTab}-1`, openStepId === `${activeTab}-1`)}
              />
              <ExpandableStep 
                id={`${activeTab}-2`}
                number="2"
                title={t('guide.upload.step2.title')}
                description={t('guide.upload.step2.desc')}
                screenshot="/screenshots-guide/upload-step2.png"
                screenshotAlt="Добавление описания"
                isOpen={openStepId === `${activeTab}-2`}
                onStepClick={() => handleStepClick(`${activeTab}-2`, openStepId === `${activeTab}-2`)}
              />
              <ExpandableStep 
                id={`${activeTab}-3`}
                number="3"
                title={t('guide.upload.step3.title')}
                description={t('guide.upload.step3.desc')}
                screenshot="/screenshots-guide/upload-step3.png"
                screenshotAlt="Загрузка файлов"
                isOpen={openStepId === `${activeTab}-3`}
                onStepClick={() => handleStepClick(`${activeTab}-3`, openStepId === `${activeTab}-3`)}
              />
              
              <ExpandableStep 
                id={`${activeTab}-4`}
                number="4"
                title={t('guide.upload.step4.title')}
                description={t('guide.upload.step4.desc')}
                screenshot="/screenshots-guide/upload-step4.png"
                screenshotAlt="Выбор ракурса для обложки проекта"
                isOpen={openStepId === `${activeTab}-4`}
                onStepClick={() => handleStepClick(`${activeTab}-4`, openStepId === `${activeTab}-4`)}
              />
              <ExpandableStep 
                id={`${activeTab}-5`}
                number="5"
                title={t('guide.upload.step5.title')}
                description={t('guide.upload.step5.desc')}
                screenshot="/screenshots-guide/upload-step5.png"
                screenshotAlt="Публикация проекта"
                isOpen={openStepId === `${activeTab}-5`}
                onStepClick={() => handleStepClick(`${activeTab}-5`, openStepId === `${activeTab}-5`)}
              />
            </div>
            <div className="tip-box">
              {t('guide.upload.tip.icon')} <strong>{t('guide.upload.tip.label')}</strong> {t('guide.upload.tip.text')}          
            </div>
          </section>
        );

      case 'view':
        return (
          <section className="guide-section">
            <h2>{t('guide.view.title')}</h2>
            <div className="steps-list">
              <div className="step-item">
                <span className="step-number">1</span>
                <div>
                  <strong>{t('guide.view.step1.title')}</strong>
                  <p>{t('guide.view.step1.desc')}</p>
                </div>
              </div>
              <div className="step-item">
                <span className="step-number">2</span>
                <div>
                  <strong>{t('guide.view.step2.title')}</strong>
                  <p>{t('guide.view.step2.desc')}</p>                </div>
              </div>
              <div className="step-item">
                <span className="step-number">3</span>
                <div>
                  <strong>{t('guide.view.step3.title')}</strong>
                  <p>{t('guide.view.step3.desc')}</p>
                </div>
              </div>
              <div className="step-item">
                <span className="step-number">4</span>
                <div>
                  <strong>{t('guide.view.step4.title')}</strong>
                  <p>{t('guide.view.step4.desc')}</p>
                </div>
              </div>
            </div>
            <div className="tip-box">
              {t('guide.view.tip.icon')} <strong>{t('guide.view.tip.label')}</strong> {t('guide.view.tip.text')}          
            </div>
          </section>
        );

      case 'share':
        return (
          <section className="guide-section">
            <h2>{t('guide.share.title')}</h2>
            <div className="grid-2">
              <div className="card">
                <h3>{t('guide.share.link.title')}</h3>
                <p>{t('guide.share.link.desc')}</p>
                <ul>
                  {t('guide.share.link.benefits', { returnObjects: true }).map((item, i) => (
                    <li key={i}>✅ {item}</li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h3>{t('guide.share.qr.title')}</h3>
                <p>{t('guide.share.qr.desc')}</p>
                <ul>
                  {t('guide.share.qr.benefits', { returnObjects: true }).map((item, i) => (
                    <li key={i}>✅ {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );

      case 'faq':
  return (
    <section className="guide-section">
      <h2>{t('guide.faq.title')}</h2>
      <table className="guide-faq">
        <thead>
          <tr>
            {(t('guide.faq.table.headers', { returnObjects: true }) || []).map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(t('guide.faq.table.rows', { returnObjects: true }) || []).map((row, i) => (
            <tr key={i}>
              <td>{row.q}</td>
              <td>{row.a}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
      default:
        return null;
    }
  };

  return (
    <div className="guide-page">
      <header className="guide-header">
        <h1>{t('guide.header.title')}</h1>
        <p>{t('guide.header.subtitle')}</p>
      </header>


      <nav className="guide-tabs" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`guide-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="guide-content" role="tabpanel">
        {renderContent()}
      </main>

      <footer className="guide-footer">
        <p>
          {t('guide.footer.text')}{' '}
          <a href="/support">{t('guide.footer.link')}</a>{' '}
          {t('guide.footer.time')}
        </p>
      </footer>
    </div>
  );
};
export default GuidePage;