// src/components/ShareModal.jsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react'; // 👈 Импорт QR-кода
import './ShareModal.css';

const ShareModal = ({ isOpen, onClose, projectId, projectTitle }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false); // 👈 Состояние для показа QR

  // Формируем публичную ссылку (без токена!)
  const shareUrl = `${window.location.origin}/project/public/${projectId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback для старых браузеров
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 👈 Сброс состояния при закрытии модального окна
  const handleClose = () => {
    setShowQR(false);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content share-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={handleClose}
          aria-label={t('modal.close')}
        >
          ✕
        </button>

        <h3 className="share-modal-h3">{t('share.modal.title')}</h3>
        <p className="share-description">{t('share.modal.description')}</p>

        {/* 👈 Переключатель: Ссылка / QR-код */}
        <div className="share-toggle">
          <button
            className={`toggle-btn ${!showQR ? 'active' : ''}`}
            onClick={() => setShowQR(false)}
            type="button"
          >
            {t('share.modal.link_tab')}
          </button>
          <button
            className={`toggle-btn ${showQR ? 'active' : ''}`}
            onClick={() => setShowQR(true)}
            type="button"
          >
            {t('share.modal.qr_tab')}
          </button>
        </div>

        {/* 👈 Контент: Ссылка */}
        {!showQR && (
          <div className="share-link-wrapper">
            <input
              type="text"
              className="share-link-input"
              value={shareUrl}
              readOnly
              onClick={(e) => e.target.select()}
              aria-label={t('share.modal.link_label')}
            />
            <button
              className={`copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              aria-label={
                copied ? t('share.modal.copied') : t('share.modal.copy_button')
              }
            >
              {copied ? t('share.modal.copied') : t('share.modal.copy_button')}
            </button>
          </div>
        )}

        {/* 👈 Контент: QR-код */}
        {showQR && (
          <div className="qr-wrapper">
            <div className="qr-code-container">
              <QRCodeSVG
                value={shareUrl}
                size={200}
                level="H" // Высокий уровень коррекции ошибок
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <p className="qr-description">{t('share.modal.qr_description')}</p>
            <button
              className="download-qr-btn"
              onClick={() => {
                const svg = document.querySelector('.qr-code-container svg');
                const svgData = new XMLSerializer().serializeToString(svg);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();

                img.onload = () => {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.drawImage(img, 0, 0);
                  const pngFile = canvas.toDataURL('image/png');
                  const downloadLink = document.createElement('a');
                  downloadLink.download = `${projectTitle || 'project'}-qr.png`;
                  downloadLink.href = pngFile;
                  downloadLink.click();
                };
                img.src =
                  'data:image/svg+xml;base64,' +
                  btoa(unescape(encodeURIComponent(svgData)));
              }}
            >
              {t('share.modal.download_qr')}
            </button>
          </div>
        )}

        {/* Разделитель */}
        <div className="share-divider">
          <span>{t('share.modal.or_share')}</span>
        </div>

        {/* Кнопки для мессенджеров — круглые с иконками */}
        <div className="share-social">
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(projectTitle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-btn telegram"
            aria-label={t('share.social.telegram')}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.578.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.786l3.023-14.24c.31-1.242-.475-1.807-1.285-1.421z"
                fill="white"
              />
            </svg>
          </a>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(projectTitle + ' ' + shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-btn whatsapp"
            aria-label={t('share.social.whatsapp')}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                fill="white"
              />
            </svg>
          </a>

          <button
            className="social-btn email"
            onClick={() =>
              (window.location.href = `mailto:?subject=${encodeURIComponent(projectTitle)}&body=${encodeURIComponent(shareUrl)}`)
            }
            aria-label={t('share.social.email')}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"
                fill="white"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
