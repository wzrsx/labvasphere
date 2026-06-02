//ТРЕБУЕТ ДОРАБОТКИ
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CONFIG } from '../config';

export const exportPortfolioToPdf = async (projects, options = {}) => {
  try {
    const {
      title = 'Портфолио дизайнера',
      author = '',
      authorAvatar = null,
      includeDrafts = false,
      pageSize = 'a4',
      orientation = 'portrait',
    } = options;

    const filteredProjects = includeDrafts 
      ? projects 
      : projects.filter(p => p?.status === 'published');

    if (filteredProjects.length === 0) {
      return { success: false, error: 'Нет опубликованных проектов' };
    }

    // Создаём контейнер
    const container = document.createElement('div');
    container.id = 'pdf-export-container';
    container.style.cssText = `
      position: fixed;
      top: -9999px;
      left: 0;
      width: 794px;
      background: #ffffff;
      z-index: 2147483647;
      pointer-events: none;
    `;

    container.innerHTML = generatePdfHtml(filteredProjects, { title, author, authorAvatar });
    document.body.appendChild(container);

    // Ждём загрузки
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Ждём изображения
    const images = container.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve; // не блокируем
      });
    }));

    // Рендерим canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Очищаем DOM
    container.remove();

    // Создаём PDF
    const pdf = new jsPDF({ orientation, unit: 'mm', format: pageSize });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

    // Многостраничность
    let heightLeft = imgHeight - pageHeight;
    let position = pageHeight;
    
    while (heightLeft > 0) {
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -position, imgWidth, imgHeight);
      position += pageHeight;
      heightLeft -= pageHeight;
    }

    // Сохраняем
    const fileName = `portfolio-${(author || 'designer').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(fileName);

    return { success: true, fileName };

  } catch (error) {
    console.error('PDF export error:', error);
    return { success: false, error: error.message };
  }
};

const generatePdfHtml = (projects, { title, author, authorAvatar }) => {
  const formatDate = (str) => {
    if (!str) return '';
    return new Date(str).toLocaleDateString('ru-RU', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    });
  };
  
  const getInitials = (name) => {
    if (!name) return 'Д';
    return name.trim().split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };
  
  const getMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = CONFIG?.MEDIA_BASE_URL;
    if (!base) return path;
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  };

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
      color: #1a1a1a; 
      background: #fff; 
      line-height: 1.5; 
    }
    .pdf-page { 
      width: 794px;
      padding: 76px;
      background: #fff; 
    }
    .cover { 
      text-align: center; 
      margin-bottom: 35px; 
      padding-bottom: 25px; 
      border-bottom: 2px solid #e5e7eb; 
    }
    .avatar-wrap { 
      width: 72px; 
      height: 72px; 
      margin: 0 auto 16px; 
    }
    .avatar { 
      width: 100%; 
      height: 100%; 
      border-radius: 50%; 
      object-fit: cover; 
      border: 3px solid #fff; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
    }
    .avatar-ph { 
      width: 100%; 
      height: 100%; 
      border-radius: 50%; 
      background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: #fff; 
      font-size: 26px; 
      font-weight: 700; 
    }
    .title { font-size: 30px; font-weight: 700; margin-bottom: 6px; color: #111; }
    .author { font-size: 16px; color: #4b5563; margin-bottom: 4px; }
    .date { font-size: 13px; color: #9ca3af; margin-bottom: 18px; }
    .stats { 
      display: flex; 
      justify-content: center; 
      gap: 32px; 
      margin-top: 16px; 
    }
    .stat { text-align: center; }
    .stat-val { font-size: 22px; font-weight: 700; color: #2563eb; }
    .stat-lbl { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-top: 2px; }
    .section-title { 
      font-size: 20px; 
      font-weight: 600; 
      margin-bottom: 20px; 
      color: #111; 
      border-left: 4px solid #2563eb; 
      padding-left: 12px; 
    }
    .project-card { 
      display: flex;
      width: 100%;
      margin-bottom: 28px;
      padding-bottom: 28px;
      border-bottom: 1px solid #f3f4f6;
      gap: 22px;
    }
    .cover-img { 
      flex: 0 0 220px;
      width: 220px;
      height: 140px;
      border-radius: 10px;
      overflow: hidden;
      background: #f9fafb;
      position: relative;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .cover-img img { 
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      position: absolute;
      top: 0;
      left: 0;
    }
    .cover-ph { 
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af; 
      font-size: 12px; 
    }
    .info { 
      flex: 1;
      min-width: 0;
    }
    .p-title { 
      font-size: 18px; 
      font-weight: 600; 
      margin-bottom: 6px; 
      color: #111; 
    }
    .p-desc { 
      font-size: 13px; 
      color: #4b5563; 
      margin-bottom: 12px; 
      line-height: 1.5; 
      max-height: 4.5em;
      overflow: hidden;
    }
    .meta { 
      display: flex; 
      gap: 12px; 
      align-items: center; 
      font-size: 12px; 
      color: #6b7280; 
    }
    .badge { 
      background: #eff6ff; 
      color: #2563eb; 
      padding: 3px 10px; 
      border-radius: 4px; 
      font-weight: 500; 
    }
    .footer { 
      margin-top: 30px; 
      padding-top: 15px; 
      border-top: 1px solid #e5e7eb; 
      text-align: center; 
      font-size: 11px; 
      color: #9ca3af; 
    }
  </style>
</head>
<body>
  <div class="pdf-page">
    <div class="cover">
      <div class="avatar-wrap">
        ${authorAvatar 
          ? `<img src="${getMediaUrl(authorAvatar)}" class="avatar" crossorigin="anonymous">`
          : `<div class="avatar-ph">${getInitials(author)}</div>`}
      </div>
      <h1 class="title">${title || 'Портфолио'}</h1>
      ${author ? `<p class="author">${author}</p>` : ''}
      <p class="date">${formatDate(new Date())}</p>
      <div class="stats">
        <div class="stat"><div class="stat-val">${projects.length}</div><div class="stat-lbl">Проектов</div></div>
        <div class="stat"><div class="stat-val">${projects.reduce((s, p) => s + (p.views_count || 0), 0)}</div><div class="stat-lbl">Просмотров</div></div>
      </div>
    </div>

    <h2 class="section-title">Проекты</h2>
    <div class="projects-list">
      ${projects.map(p => {
        const coverUrl = p.cover_image_url ? getMediaUrl(p.cover_image_url) : null;
        return `
        <div class="project-card">
          <div class="cover-img">
            ${coverUrl 
              ? `<img src="${coverUrl}" crossorigin="anonymous">`
              : '<div class="cover-ph">Нет фото</div>'}
          </div>
          <div class="info">
            <h3 class="p-title">${p.title || 'Без названия'}</h3>
            ${p.description ? `<p class="p-desc">${p.description}</p>` : ''}
            <div class="meta">
              <span class="badge">${p.status === 'published' ? 'Опубликован' : 'Черновик'}</span>
              <span>👁️ ${p.views_count || 0}</span>
              <span>📅 ${formatDate(p.created_at)}</span>
            </div>
          </div>
        </div>
      `}).join('')}
    </div>

    <div class="footer">Сгенерировано • ${new Date().getFullYear()}</div>
  </div>
</body>
</html>`;
};