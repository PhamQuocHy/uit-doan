// Read Unicode directly from disk: do not pipe Vietnamese source through a shell.
const fs = require('node:fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const source = process.argv[2];
if (!source || !source.endsWith('.md')) throw new Error('Usage: node scripts/export-report-word.cjs path/to/report.md');
const text = fs.readFileSync(source, 'utf8');
if (text.includes('\ufffd')) throw new Error('Invalid Unicode source');
const children = text.split(/\r?\n/).filter(line => line.trim()).map(line => {
  const level = line.startsWith('# ') ? 1 : line.startsWith('## ') ? 2 : 0;
  const value = level ? line.slice(level + 1) : line.startsWith('- ') ? line.slice(2) : line;
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : undefined,
    keepNext: !!level,
    bullet: line.startsWith('- ') ? { level: 0 } : undefined,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: level ? 180 : 0, after: 120, line: 360 },
    children: value.split(/(\*\*.*?\*\*)/g).filter(Boolean).map(part => new TextRun({
      text: part.replace(/\*\*/g, ''), bold: !!level || part.startsWith('**'),
      font: 'Times New Roman', size: level === 1 ? 30 : level === 2 ? 28 : 26,
    })),
  });
});
const doc = new Document({ sections: [{ properties: { page: {
  size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
} }, children }] });
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(source.replace(/\.md$/, '.docx'), buffer);
  console.log('Word document created from UTF-8 source.');
}).catch(() => { console.error('Cannot write Word document. Close the document and try again.'); process.exitCode = 1; });
