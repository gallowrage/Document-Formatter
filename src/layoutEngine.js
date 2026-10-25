/**
 * Layout & Space-Budget Pagination Engine
 * 
 * Simulates a Desktop Publishing (DTP) page budget:
 * - Standard US Letter (8.5 x 11 in) at 96 DPI: 816px x 1056px (or A4: 794px x 1123px)
 * - Subtracts Margins, Running Header, Running Footer
 * - Distributes items using a space budget bin-packing algorithm
 */

export const THEMES = {
  magazine: {
    id: 'magazine',
    name: 'Editorial Magazine',
    fontHeadline: "'Playfair Display', Georgia, serif",
    fontBody: "'Merriweather', Georgia, serif",
    accentColor: '#b91c1c',
    primaryColor: '#18181b',
    surfaceColor: '#ffffff',
    bgPage: '#fcfbf7',
    columns: 2,
    columnGap: '28px',
    dropCap: true,
    tableTheme: 'editorial'
  },
  executive: {
    id: 'executive',
    name: 'Executive Briefing',
    fontHeadline: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    accentColor: '#2563eb',
    primaryColor: '#0f172a',
    surfaceColor: '#ffffff',
    bgPage: '#ffffff',
    columns: 2,
    columnGap: '24px',
    dropCap: false,
    tableTheme: 'corporate'
  },
  modernist: {
    id: 'modernist',
    name: 'Modernist Tech & Data',
    fontHeadline: "'Space Grotesk', system-ui, sans-serif",
    fontBody: "'Plus Jakarta Sans', system-ui, sans-serif",
    accentColor: '#8b5cf6',
    primaryColor: '#09090b',
    surfaceColor: '#f4f4f5',
    bgPage: '#fafafa',
    columns: 2,
    columnGap: '20px',
    dropCap: false,
    tableTheme: 'minimal'
  },
  dark_slate: {
    id: 'dark_slate',
    name: 'Dark Slate Studio',
    fontHeadline: "'Outfit', sans-serif",
    fontBody: "'Inter', sans-serif",
    accentColor: '#38bdf8',
    primaryColor: '#f8fafc',
    surfaceColor: '#1e293b',
    bgPage: '#0f172a',
    columns: 2,
    columnGap: '24px',
    dropCap: false,
    tableTheme: 'dark'
  }
};

export class PaginationEngine {
  constructor(options = {}) {
    this.pageWidth = options.pageWidth || 816; // 8.5in at 96dpi
    this.pageHeight = options.pageHeight || 1056; // 11in at 96dpi
    this.margins = options.margins || { top: 54, bottom: 54, left: 48, right: 48 };
    this.headerHeight = options.headerHeight || 40;
    this.footerHeight = options.footerHeight || 36;
    
    // Printable vertical height budget per page
    this.usableHeight = this.pageHeight - (this.margins.top + this.margins.bottom + this.headerHeight + this.footerHeight);
  }

  paginate(blocks, options = {}) {
    const pages = [];
    let currentPage = this.createPage(1);

    for (const block of blocks) {
      const neededHeight = block.estimatedHeight || 120;

      // Full-span blocks (wide tables, wide infographics) require significant space
      if (block.preferredLayout === 'full' && currentPage.usedHeight > (this.usableHeight * 0.45)) {
        // If current page is already half-full, push this full-span block to a fresh page to avoid cramming
        pages.push(currentPage);
        currentPage = this.createPage(pages.length + 1);
      }

      // If block exceeds remaining vertical budget, start a new page
      if (currentPage.usedHeight + neededHeight > this.usableHeight && currentPage.blocks.length > 0) {
        pages.push(currentPage);
        currentPage = this.createPage(pages.length + 1);
      }

      currentPage.blocks.push(block);
      currentPage.usedHeight += neededHeight;
    }

    if (currentPage.blocks.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }

  createPage(pageNumber) {
    return {
      pageNumber,
      blocks: [],
      usedHeight: 0,
      availableHeight: this.usableHeight
    };
  }
}
