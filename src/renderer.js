import { THEMES } from './layoutEngine.js';

export function renderDocumentHtml(pages, options = {}) {
  const themeKey = options.theme || 'executive';
  const theme = THEMES[themeKey] || THEMES.executive;
  const docTitle = options.title || 'Dynamic Publication';

  const pagesHtml = pages.map((page, index) => renderPageHtml(page, index + 1, pages.length, theme)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(docTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&family=Playfair+Display:ital,wght@0,600;0,800;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: letter portrait;
      margin: 0;
    }

    :root {
      --font-display: ${theme.fontHeadline};
      --font-body: ${theme.fontBody};
      --accent: ${theme.accentColor};
      --primary: ${theme.primaryColor};
      --surface: ${theme.surfaceColor};
      --bg-page: ${theme.bgPage};
      --column-gap: ${theme.columnGap};
      --columns: ${theme.columns};
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: #475569;
      font-family: var(--font-body);
      color: var(--primary);
      -webkit-font-smoothing: antialiased;
    }

    /* Print page canvas: 8.5in x 11in */
    .page-sheet {
      width: 8.5in;
      height: 11in;
      background: var(--bg-page);
      position: relative;
      margin: 20px auto;
      padding: 54px 48px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      page-break-after: always;
      break-after: page;
    }

    @media print {
      body {
        background: transparent;
      }
      .page-sheet {
        margin: 0;
        box-shadow: none;
        width: 100vw;
        height: 100vh;
      }
    }

    /* Running Header */
    .page-header {
      height: 38px;
      border-bottom: 1.5px solid var(--accent);
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      font-size: 11px;
      font-family: var(--font-display);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      font-weight: 700;
    }

    /* Running Footer */
    .page-footer {
      margin-top: auto;
      height: 34px;
      border-top: 1px solid rgba(148, 163, 184, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #64748b;
      font-family: var(--font-body);
    }

    /* Page Content Grid Flow */
    .page-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Headings */
    h1.doc-title {
      font-family: var(--font-display);
      font-size: 30px;
      line-height: 1.2;
      color: var(--primary);
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    h2.section-heading {
      font-family: var(--font-display);
      font-size: 20px;
      line-height: 1.25;
      color: var(--primary);
      margin-top: 6px;
      margin-bottom: 10px;
      border-left: 4px solid var(--accent);
      padding-left: 10px;
    }

    h3.sub-heading {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 600;
      margin-top: 4px;
      margin-bottom: 6px;
      color: var(--accent);
    }

    /* Multicolumn narrative container */
    .multi-column-flow {
      column-count: var(--columns);
      column-gap: var(--column-gap);
      column-fill: balance;
      font-size: 12.5px;
      line-height: 1.65;
      text-align: justify;
    }

    p {
      margin-bottom: 12px;
      break-inside: avoid;
    }

    ${theme.dropCap ? `
    .multi-column-flow p:first-of-type::first-letter {
      font-size: 44px;
      float: left;
      line-height: 0.85;
      padding-right: 8px;
      font-family: var(--font-display);
      color: var(--accent);
      font-weight: 700;
    }
    ` : ''}

    /* Callout & Quotes */
    blockquote {
      background: var(--surface);
      border-left: 4px solid var(--accent);
      padding: 12px 16px;
      margin: 14px 0;
      border-radius: 0 8px 8px 0;
      font-style: italic;
      font-size: 13.5px;
      color: var(--primary);
      break-inside: avoid;
    }

    /* Figures & Infographics */
    .figure-card {
      background: var(--surface);
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      break-inside: avoid;
    }

    .figure-card img {
      max-width: 100%;
      height: auto;
      max-height: 280px;
      border-radius: 6px;
      object-fit: contain;
    }

    .figure-caption {
      margin-top: 8px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      font-style: italic;
    }

    /* Data Tables */
    .data-table-card {
      background: var(--surface);
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      overflow: hidden;
      break-inside: avoid;
      margin: 10px 0;
    }

    .data-table-card .table-title {
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 700;
      padding: 8px 14px;
      background: rgba(148, 163, 184, 0.1);
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }

    th {
      background: ${theme.tableTheme === 'dark' ? '#334155' : 'rgba(148, 163, 184, 0.12)'};
      color: ${theme.tableTheme === 'dark' ? '#f8fafc' : 'var(--primary)'};
      text-align: left;
      padding: 7px 12px;
      font-weight: 600;
      font-size: 11px;
      border-bottom: 2px solid var(--accent);
    }

    td {
      padding: 7px 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.15);
    }

    tr:last-child td {
      border-bottom: none;
    }

    ul {
      margin-left: 18px;
      margin-bottom: 12px;
      font-size: 12.5px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

function renderPageHtml(page, pageNum, totalPages, theme) {
  let contentHtml = '';

  for (const block of page.blocks) {
    if (block.type === 'section') {
      let sectionHead = '';
      if (block.heading) {
        if (block.level === 1) {
          sectionHead = `<h1 class="doc-title">${escapeHtml(block.heading)}</h1>`;
        } else if (block.level === 2) {
          sectionHead = `<h2 class="section-heading">${escapeHtml(block.heading)}</h2>`;
        } else {
          sectionHead = `<h3 class="sub-heading">${escapeHtml(block.heading)}</h3>`;
        }
      }

      let itemsHtml = '';
      for (const item of block.items) {
        if (item.type === 'paragraph') {
          itemsHtml += `<p>${item.html}</p>`;
        } else if (item.type === 'quote') {
          itemsHtml += `<blockquote>${item.raw}</blockquote>`;
        } else if (item.type === 'list') {
          itemsHtml += `<ul>${item.items.map(li => `<li>${li}</li>`).join('')}</ul>`;
        }
      }

      contentHtml += `
        <div class="block-section">
          ${sectionHead}
          <div class="multi-column-flow">
            ${itemsHtml}
          </div>
        </div>
      `;
    } else if (block.type === 'figure') {
      contentHtml += `
        <div class="figure-card">
          <img src="${block.src}" alt="${escapeHtml(block.title)}" />
          <div class="figure-caption">${escapeHtml(block.title)}</div>
        </div>
      `;
    } else if (block.type === 'table') {
      const { headers, rows } = block.data;
      const headersHtml = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
      const rowsHtml = rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');

      contentHtml += `
        <div class="data-table-card">
          <div class="table-title">${escapeHtml(block.title)}</div>
          <table>
            <thead><tr>${headersHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    }
  }

  return `
    <div class="page-sheet" data-page="${pageNum}">
      <div class="page-header">
        <span>Strategic Synthesis & Intelligence Report</span>
        <span>${theme.name}</span>
      </div>
      <div class="page-body">
        ${contentHtml}
      </div>
      <div class="page-footer">
        <span>Automated Publisher Engine</span>
        <span>Page ${pageNum} of ${totalPages}</span>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
