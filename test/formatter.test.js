import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { THEMES, PaginationEngine } from '../src/layoutEngine.js';
import { ingestBucket } from '../src/ingestion.js';
import { renderDocumentHtml } from '../src/renderer.js';
import { generatePdf } from '../src/pdfExporter.js';
import { parseCliArgs } from '../cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Document-Formatter Layout & Pagination Engine', () => {
  it('should define all 4 canonical publication themes with correct properties', () => {
    const requiredThemes = ['magazine', 'executive', 'modernist', 'dark_slate'];
    for (const id of requiredThemes) {
      assert.ok(THEMES[id], `Theme ${id} must exist in THEMES`);
      assert.strictEqual(THEMES[id].id, id);
      assert.ok(THEMES[id].fontHeadline, `Theme ${id} must specify fontHeadline`);
      assert.ok(THEMES[id].accentColor, `Theme ${id} must specify accentColor`);
      assert.ok(THEMES[id].columns >= 1, `Theme ${id} must have >= 1 columns`);
    }
  });

  it('should calculate page height budget accurately', () => {
    const engine = new PaginationEngine({
      pageHeight: 1000,
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      headerHeight: 40,
      footerHeight: 40
    });
    // usableHeight = 1000 - (50 + 50 + 40 + 40) = 820
    assert.strictEqual(engine.usableHeight, 820);
  });

  it('should paginate content blocks across multiple sheets when budget is exceeded', () => {
    const engine = new PaginationEngine({
      pageHeight: 1000,
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      headerHeight: 40,
      footerHeight: 40
    });
    // Usable height is 820.
    const blocks = [
      { id: 'b1', type: 'text', estimatedHeight: 500, content: 'Block 1' },
      { id: 'b2', type: 'text', estimatedHeight: 400, content: 'Block 2' },
      { id: 'b3', type: 'text', estimatedHeight: 200, content: 'Block 3' },
    ];

    const pages = engine.paginate(blocks);
    assert.strictEqual(pages.length, 2, 'Should distribute across 2 pages');
    assert.strictEqual(pages[0].blocks.length, 1);
    assert.strictEqual(pages[1].blocks.length, 2);
  });

  it('should push full-span elements to fresh page when current page is already half-full', () => {
    const engine = new PaginationEngine();
    const blocks = [
      { id: 'b1', type: 'text', estimatedHeight: engine.usableHeight * 0.5, content: 'Intro' },
      { id: 'b2', type: 'table', preferredLayout: 'full', estimatedHeight: 200, content: 'Wide Table' }
    ];

    const pages = engine.paginate(blocks);
    assert.strictEqual(pages.length, 2, 'Full span block should be pushed to page 2');
    assert.strictEqual(pages[1].blocks[0].id, 'b2');
  });
});

describe('Document-Formatter Ingestion & Renderer', () => {
  it('should ingest markdown and metadata blocks from sample bucket', () => {
    const sampleDir = path.join(projectRoot, 'sample_bucket');
    assert.ok(fs.existsSync(sampleDir), 'sample_bucket must exist');

    const blocks = ingestBucket(sampleDir);
    assert.ok(Array.isArray(blocks));
    assert.ok(blocks.length > 0, 'Should ingest at least 1 block');
  });

  it('should render document HTML with requested theme and headers', () => {
    const pages = [
      {
        pageNumber: 1,
        blocks: [
          {
            type: 'section',
            heading: 'Overview Heading',
            level: 1,
            items: [
              { type: 'paragraph', html: 'Body text for testing document renderer' }
            ]
          }
        ],
        usedHeight: 100,
        availableHeight: 800
      }
    ];

    const html = renderDocumentHtml(pages, { theme: 'modernist', title: 'Test Document' });
    assert.ok(typeof html === 'string');
    assert.ok(html.includes('Test Document'));
    assert.ok(html.includes('Space Grotesk'), 'Should include modernist fontHeadline');
    assert.ok(html.includes('#8b5cf6'), 'Should include modernist accentColor');
    assert.ok(html.includes('Body text'));
  });
});

describe('Document-Formatter CLI Parameterization', () => {
  it('should parse custom theme and path flags correctly', () => {
    const args = ['--theme', 'magazine', '--input', './custom_in', '--output', './custom_out.pdf', '--title', 'Custom Title'];
    const options = parseCliArgs(args);

    assert.strictEqual(options.theme, 'magazine');
    assert.strictEqual(options.title, 'Custom Title');
    assert.ok(options.input.includes('custom_in'));
    assert.ok(options.output.includes('custom_out.pdf'));
    assert.strictEqual(options.help, false);
  });

  it('should handle short flags (-t, -i, -o, -h)', () => {
    const args = ['-t', 'dark_slate', '-o', 'report.pdf', '-h'];
    const options = parseCliArgs(args);

    assert.strictEqual(options.theme, 'dark_slate');
    assert.strictEqual(options.help, true);
    assert.ok(options.output.includes('report.pdf'));
  });

  it('should fallback to positional theme argument', () => {
    const args = ['modernist'];
    const options = parseCliArgs(args);

    assert.strictEqual(options.theme, 'modernist');
  });
});

describe('PDF Exporter Verification', () => {
  it('should compile HTML into a valid PDF file via Puppeteer', async () => {
    const testOutputPath = path.join(projectRoot, 'output', 'test-verification.pdf');
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Test PDF</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Automated PDF Test</h1>
          <p>Verifying headless Chrome PDF rendering pipeline.</p>
        </body>
      </html>
    `;

    await generatePdf(testHtml, testOutputPath);
    assert.ok(fs.existsSync(testOutputPath), 'PDF file must be written to disk');

    const fileBuffer = fs.readFileSync(testOutputPath);
    assert.ok(fileBuffer.length > 500, 'PDF buffer should be non-empty');
    assert.strictEqual(fileBuffer.subarray(0, 4).toString(), '%PDF', 'Must have %PDF header');
  });
});
