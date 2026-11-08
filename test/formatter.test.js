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
import { app } from '../server.js';

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

  it('should handle empty block list and fallback to default estimatedHeight when omitted', () => {
    const engine = new PaginationEngine();
    assert.deepStrictEqual(engine.paginate([]), []);

    const pages = engine.paginate([{ id: 'no-height', type: 'section' }]);
    assert.strictEqual(pages.length, 1);
    assert.strictEqual(pages[0].usedHeight, 120);
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

  it('should throw an error when ingesting a non-existent bucket directory', () => {
    const missingDir = path.join(projectRoot, 'non_existent_bucket_xyz');
    assert.throws(
      () => ingestBucket(missingDir),
      /Bucket directory not found/
    );
  });

  it('should ingest subdirectories (skipped), images (.png), empty/quoted CSVs, and headingless markdown', () => {
    const tempBucket = path.join(projectRoot, 'output', 'temp_test_bucket');
    fs.mkdirSync(path.join(tempBucket, 'nested_dir'), { recursive: true });

    try {
      // 1. Headingless .txt file with blockquote and list
      fs.writeFileSync(
        path.join(tempBucket, 'notes.txt'),
        'Introductory paragraph without heading.\n\n> A wise quote\n\n- Item A\n- Item B\n'
      );

      // 2. Binary image (.png)
      fs.writeFileSync(
        path.join(tempBucket, 'chart_preview.png'),
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );

      // 3. CSV with escaped quotes and commas
      fs.writeFileSync(
        path.join(tempBucket, 'quoted_metrics.csv'),
        'Metric,Description\n"Latency ""p99""","Fast, reliable"\n'
      );

      // 4. Empty CSV
      fs.writeFileSync(path.join(tempBucket, 'empty.csv'), '   \n  ');

      const blocks = ingestBucket(tempBucket);

      const sectionBlock = blocks.find(b => b.type === 'section');
      assert.ok(sectionBlock, 'Should parse .txt into section block');
      assert.strictEqual(sectionBlock.heading, '');
      assert.strictEqual(sectionBlock.items.length, 3);

      const pngBlock = blocks.find(b => b.id === 'img-chart_preview.png');
      assert.ok(pngBlock, 'Should ingest .png file as figure block');
      assert.strictEqual(pngBlock.preferredLayout, 'column');
      assert.ok(pngBlock.src.startsWith('data:image/png;base64,'));
      assert.strictEqual(pngBlock.title, 'chart preview');

      const quotedCsvBlock = blocks.find(b => b.id === 'tbl-quoted_metrics.csv');
      assert.ok(quotedCsvBlock, 'Should ingest quoted CSV');
      assert.deepStrictEqual(quotedCsvBlock.data.headers, ['Metric', 'Description']);
      assert.deepStrictEqual(quotedCsvBlock.data.rows[0], ['Latency "p99"', 'Fast, reliable']);

      const emptyCsvBlock = blocks.find(b => b.id === 'tbl-empty.csv');
      assert.ok(emptyCsvBlock, 'Should handle empty CSV');
      assert.deepStrictEqual(emptyCsvBlock.data, { headers: [], rows: [] });
    } finally {
      fs.rmSync(tempBucket, { recursive: true, force: true });
    }
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

  it('should render all block variants (h2, h3, quotes, lists, figures, tables), dropCaps, dark tables, and escape HTML special chars', () => {
    const pages = [
      {
        pageNumber: 1,
        blocks: [
          {
            type: 'section',
            heading: 'Section <Two> & "More"',
            level: 2,
            items: [
              { type: 'quote', raw: 'Critical insight here' },
              { type: 'list', items: ['Point 1', 'Point 2'] }
            ]
          },
          {
            type: 'section',
            heading: "Sub-heading 'Three'",
            level: 3,
            items: []
          },
          {
            type: 'section',
            heading: '',
            level: 1,
            items: [{ type: 'paragraph', html: 'Unheaded paragraph' }]
          },
          {
            type: 'figure',
            src: 'data:image/svg+xml;utf8,<svg></svg>',
            title: 'Architecture & Flow <1>'
          },
          {
            type: 'table',
            title: 'Quarterly "Metrics"',
            data: {
              headers: ['Quarter & Year', 'Revenue'],
              rows: [['Q1 \'26', '$100M']]
            }
          }
        ],
        usedHeight: 400,
        availableHeight: 800
      }
    ];

    // Test magazine theme (dropCap: true)
    const magHtml = renderDocumentHtml(pages, { theme: 'magazine', title: 'Mag & "News"' });
    assert.ok(magHtml.includes('::first-letter'), 'Magazine theme should enable dropCap CSS');
    assert.ok(magHtml.includes('<h2 class="section-heading">Section &lt;Two&gt; &amp; &quot;More&quot;</h2>'));
    assert.ok(magHtml.includes('<h3 class="sub-heading">Sub-heading &#039;Three&#039;</h3>'));
    assert.ok(magHtml.includes('<blockquote>Critical insight here</blockquote>'));
    assert.ok(magHtml.includes('<ul><li>Point 1</li><li>Point 2</li></ul>'));
    assert.ok(magHtml.includes('class="figure-card"'));
    assert.ok(magHtml.includes('Architecture &amp; Flow &lt;1&gt;'));
    assert.ok(magHtml.includes('class="data-table-card"'));
    assert.ok(magHtml.includes('<td>Q1 &#039;26</td>'));

    // Test dark_slate theme (tableTheme: 'dark') & fallback options
    const darkHtml = renderDocumentHtml(pages, { theme: 'dark_slate' });
    assert.ok(darkHtml.includes('#334155'), 'dark_slate theme should apply dark table header background');
    assert.ok(darkHtml.includes('<title>Dynamic Publication</title>'));

    // Test unknown theme fallback to executive
    const fallbackHtml = renderDocumentHtml(pages, { theme: 'non_existent_theme' });
    assert.ok(fallbackHtml.includes('Executive Briefing'));
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

  it('should handle short flags (-t, -i, -o, -h) and --bucket alias', () => {
    const args = ['-t', 'dark_slate', '--bucket', './my_bucket', '-o', 'report.pdf', '-h'];
    const options = parseCliArgs(args);

    assert.strictEqual(options.theme, 'dark_slate');
    assert.strictEqual(options.help, true);
    assert.ok(options.input.includes('my_bucket'));
    assert.ok(options.output.includes('report.pdf'));
  });

  it('should fallback to positional theme argument', () => {
    const args = ['modernist'];
    const options = parseCliArgs(args);

    assert.strictEqual(options.theme, 'modernist');
  });

  it('should print help and return early when --help is passed to runCli', async () => {
    const { runCli, printHelp } = await import('../cli.js');
    printHelp();
    const res = await runCli(['--help']);
    assert.strictEqual(res.help, true);
  });

  it('should execute end-to-end CLI pipeline via runCli into a nested output directory', async () => {
    const { runCli } = await import('../cli.js');
    const nestedOutDir = path.join(projectRoot, 'output', 'nested_cli_test');
    const outPdf = path.join(nestedOutDir, 'cli-run.pdf');

    if (fs.existsSync(nestedOutDir)) {
      fs.rmSync(nestedOutDir, { recursive: true, force: true });
    }

    try {
      const result = await runCli(['--theme', 'executive', '--output', outPdf, '--title', 'CLI E2E Test']);
      assert.strictEqual(result.options.theme, 'executive');
      assert.ok(result.blocks.length > 0);
      assert.ok(result.pages.length > 0);
      assert.ok(fs.existsSync(outPdf), 'CLI should generate output PDF in newly created directory');
    } finally {
      fs.rmSync(nestedOutDir, { recursive: true, force: true });
    }
  });
});

describe('PDF Exporter Verification', () => {
  it('should compile HTML into a valid PDF file via Puppeteer and create missing parent directories', async () => {
    const nestedDir = path.join(projectRoot, 'output', 'nested_pdf_test');
    const testOutputPath = path.join(nestedDir, 'test-verification.pdf');
    if (fs.existsSync(nestedDir)) {
      fs.rmSync(nestedDir, { recursive: true, force: true });
    }

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

    try {
      await generatePdf(testHtml, testOutputPath);
      assert.ok(fs.existsSync(testOutputPath), 'PDF file must be written to disk');

      const fileBuffer = fs.readFileSync(testOutputPath);
      assert.ok(fileBuffer.length > 500, 'PDF buffer should be non-empty');
      assert.strictEqual(fileBuffer.subarray(0, 4).toString(), '%PDF', 'Must have %PDF header');
    } finally {
      fs.rmSync(nestedDir, { recursive: true, force: true });
    }
  });
});

describe('Express Studio API Server Endpoints', () => {
  it('should serve /api/status and /api/preview endpoints accurately', async () => {
    const server = app.listen(0);
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const statusRes = await fetch(`${baseUrl}/api/status`);
      assert.strictEqual(statusRes.status, 200);
      const statusJson = await statusRes.json();
      assert.ok(statusJson.themes.executive);
      assert.ok(Array.isArray(statusJson.bucketFiles));
      assert.ok(statusJson.bucketFiles.length > 0);

      const previewRes = await fetch(`${baseUrl}/api/preview?theme=magazine`);
      assert.strictEqual(previewRes.status, 200);
      assert.ok(previewRes.headers.get('content-type').includes('text/html'));
      const previewHtml = await previewRes.text();
      assert.ok(previewHtml.includes('Editorial Magazine'));

      const exportRes = await fetch(`${baseUrl}/api/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'modernist' })
      });
      assert.strictEqual(exportRes.status, 200);
      const pdfBytes = Buffer.from(await exportRes.arrayBuffer());
      assert.strictEqual(pdfBytes.subarray(0, 4).toString(), '%PDF');
    } finally {
      server.close();
    }
  });
});
