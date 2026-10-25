import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

/**
 * Ingests a directory bucket of mixed assets and parses them into layout blocks
 * with intrinsic metadata for space budgeting.
 */
export function ingestBucket(bucketDir) {
  if (!fs.existsSync(bucketDir)) {
    throw new Error(`Bucket directory not found: ${bucketDir}`);
  }

  const files = fs.readdirSync(bucketDir);
  const blocks = [];

  for (const file of files) {
    const fullPath = path.join(bucketDir, file);
    const ext = path.extname(file).toLowerCase();
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) continue;

    if (ext === '.md' || ext === '.txt') {
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsedBlocks = parseMarkdownToBlocks(content, file);
      blocks.push(...parsedBlocks);
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
      const isSvg = ext === '.svg';
      const fileData = fs.readFileSync(fullPath);
      const mime = isSvg ? 'image/svg+xml' : `image/${ext.replace('.', '')}`;
      const base64Uri = isSvg 
        ? `data:image/svg+xml;utf8,${encodeURIComponent(fileData.toString('utf8'))}`
        : `data:${mime};base64,${fileData.toString('base64')}`;

      blocks.push({
        id: `img-${file}`,
        source: file,
        type: 'figure',
        src: base64Uri,
        title: path.basename(file, ext).replace(/[_-]/g, ' '),
        // Publisher layout hints: 'full' (span all cols), 'column' (single col), 'feature'
        preferredLayout: isSvg ? 'full' : 'column',
        // Estimated height points for initial budget calculations
        estimatedHeight: 240
      });
    } else if (ext === '.csv') {
      const content = fs.readFileSync(fullPath, 'utf8');
      const tableData = parseCSV(content);
      blocks.push({
        id: `tbl-${file}`,
        source: file,
        type: 'table',
        title: path.basename(file, ext).replace(/[_-]/g, ' '),
        data: tableData,
        preferredLayout: 'full',
        estimatedHeight: 50 + (tableData.rows.length * 32)
      });
    }
  }

  return blocks;
}

function parseMarkdownToBlocks(mdContent, filename) {
  const tokens = marked.lexer(mdContent);
  const blocks = [];

  let currentSection = {
    id: `sec-${filename}-0`,
    type: 'section',
    source: filename,
    heading: '',
    level: 1,
    items: [],
    estimatedHeight: 60
  };

  for (const token of tokens) {
    if (token.type === 'heading') {
      if (currentSection.items.length > 0 || currentSection.heading) {
        blocks.push(currentSection);
      }
      currentSection = {
        id: `sec-${filename}-${blocks.length + 1}`,
        type: 'section',
        source: filename,
        heading: token.text,
        level: token.depth,
        items: [],
        estimatedHeight: token.depth === 1 ? 70 : 45
      };
    } else if (token.type === 'paragraph') {
      currentSection.items.push({
        type: 'paragraph',
        html: marked.parseInline(token.text),
        textLength: token.text.length
      });
      currentSection.estimatedHeight += Math.max(35, Math.ceil(token.text.length / 80) * 22);
    } else if (token.type === 'blockquote') {
      currentSection.items.push({
        type: 'quote',
        html: marked.parse(token.text),
        raw: token.text
      });
      currentSection.estimatedHeight += 70;
    } else if (token.type === 'list') {
      currentSection.items.push({
        type: 'list',
        items: token.items.map(i => marked.parseInline(i.text))
      });
      currentSection.estimatedHeight += token.items.length * 28;
    }
  }

  if (currentSection.items.length > 0 || currentSection.heading) {
    blocks.push(currentSection);
  }

  return blocks;
}

function parseCSV(csvContent) {
  const lines = csvContent.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    // Simple CSV parser handling quotes
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
    const matches = [];
    let match;
    while ((match = regex.exec(line))) {
      let val = match[1];
      if (val !== undefined && match.index < line.length) {
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).replace(/""/g, '"');
        }
        matches.push(val.trim());
      }
    }
    return matches;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(l => parseLine(l));
  return { headers, rows };
}
