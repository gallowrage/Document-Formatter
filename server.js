import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ingestBucket } from './src/ingestion.js';
import { PaginationEngine, THEMES } from './src/layoutEngine.js';
import { renderDocumentHtml } from './src/renderer.js';
import { generatePdf } from './src/pdfExporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3840;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get available themes and bucket status
app.get('/api/status', (req, res) => {
  const bucketDir = path.join(__dirname, 'sample_bucket');
  const files = fs.existsSync(bucketDir) ? fs.readdirSync(bucketDir) : [];
  res.json({
    themes: THEMES,
    bucketFiles: files
  });
});

// API: Render layout HTML preview
app.get('/api/preview', (req, res) => {
  const theme = req.query.theme || 'executive';
  const bucketDir = path.join(__dirname, 'sample_bucket');
  
  try {
    const blocks = ingestBucket(bucketDir);
    const engine = new PaginationEngine();
    const pages = engine.paginate(blocks);
    const html = renderDocumentHtml(pages, { theme, title: 'AI Synthesis Report' });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Error generating preview: ${err.message}`);
  }
});

// API: Generate & download PDF
app.post('/api/export-pdf', async (req, res) => {
  const { theme = 'executive' } = req.body;
  const bucketDir = path.join(__dirname, 'sample_bucket');
  const outputPath = path.join(__dirname, 'output', `publication-${theme}.pdf`);

  try {
    const blocks = ingestBucket(bucketDir);
    const engine = new PaginationEngine();
    const pages = engine.paginate(blocks);
    const html = renderDocumentHtml(pages, { theme, title: 'AI Synthesis Report' });

    await generatePdf(html, outputPath);
    res.download(outputPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Publisher PDF Studio is running!`);
  console.log(`👉 Open http://localhost:${PORT} in your browser to preview and style on the fly.`);
});
