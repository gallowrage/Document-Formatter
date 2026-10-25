import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ingestBucket } from './src/ingestion.js';
import { PaginationEngine, THEMES } from './src/layoutEngine.js';
import { renderDocumentHtml } from './src/renderer.js';
import { generatePdf } from './src/pdfExporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function parseCliArgs(argv) {
  const options = {
    theme: 'executive',
    input: path.join(__dirname, 'sample_bucket'),
    output: null,
    title: 'AI Synthesis Report',
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if ((arg === '--theme' || arg === '-t') && i + 1 < argv.length) {
      options.theme = argv[++i];
    } else if ((arg === '--input' || arg === '-i' || arg === '--bucket') && i + 1 < argv.length) {
      options.input = path.resolve(process.cwd(), argv[++i]);
    } else if ((arg === '--output' || arg === '-o') && i + 1 < argv.length) {
      options.output = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--title' && i + 1 < argv.length) {
      options.title = argv[++i];
    } else if (!arg.startsWith('-') && !options.customThemeSet) {
      options.theme = arg;
      options.customThemeSet = true;
    }
  }

  if (!options.output) {
    options.output = path.join(__dirname, 'output', `publication-${options.theme}.pdf`);
  }

  return options;
}

export function printHelp() {
  console.log(`
Publisher PDF Engine CLI
Usage: node cli.js [options] [theme]

Options:
  -t, --theme <name>     Theme to render (magazine, executive, modernist, dark_slate) [default: executive]
  -i, --input <dir>      Input directory containing markdown/json content [default: sample_bucket]
  -o, --output <file>    Output PDF file path [default: output/publication-<theme>.pdf]
      --title <string>   Document title for header [default: AI Synthesis Report]
  -h, --help             Display this help message
`);
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);

  if (options.help) {
    printHelp();
    return options;
  }

  const outDir = path.dirname(options.output);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\n📦 Ingesting content from: ${options.input}`);
  const blocks = ingestBucket(options.input);
  console.log(`  Found ${blocks.length} content blocks.`);

  console.log(`📐 Running Space-Budget Pagination Engine...`);
  const engine = new PaginationEngine();
  const pages = engine.paginate(blocks);
  console.log(`  Calculated ${pages.length} paginated layout sheets.`);

  console.log(`🎨 Rendering HTML with theme: "${options.theme}"...`);
  const html = renderDocumentHtml(pages, { theme: options.theme, title: options.title });

  console.log(`🖨️ Compiling PDF with Headless Chrome...`);
  await generatePdf(html, options.output);
  console.log(`✅ PDF successfully generated at: ${options.output}\n`);

  return { options, blocks, pages, html };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli().catch(err => {
    console.error('Execution failed:', err);
    process.exit(1);
  });
}
