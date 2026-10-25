import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

/**
 * Headless Chrome PDF exporter.
 * Compiles calculated HTML layouts directly into precise PDF publications.
 */
export async function generatePdf(htmlContent, outputPath) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport to letter proportions
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });
    
    // Set content and wait until network & web fonts are completely idle
    await page.setContent(htmlContent, { waitUntil: ['networkidle0', 'domcontentloaded'] });

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    return outputPath;
  } finally {
    await browser.close();
  }
}
