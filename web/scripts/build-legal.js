import fs from 'node:fs';
import path from 'node:path';

const documents = [
  ['TERMOS_DE_USO.md', 'termos.html'],
  ['POLITICA_DE_PRIVACIDADE.md', 'privacidade.html'],
  ['POLITICA_DE_MODERACAO.md', 'moderacao.html'],
  ['TERMO_DE_TESTADOR_BETA.md', 'termo-beta.html'],
];

const sourceDir = path.resolve('..', 'docs', 'legal');
const outputDir = path.resolve('public', 'legal');
fs.mkdirSync(outputDir, { recursive: true });

const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

for (const [source, output] of documents) {
  const markdown = fs.readFileSync(path.join(sourceDir, source), 'utf8');
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lixo na Rua — documento jurídico</title>
<style>body{margin:0;background:#f8faf7;color:#1f2937;font:16px/1.65 system-ui,sans-serif}main{max-width:820px;margin:auto;padding:32px 20px 64px}pre{white-space:pre-wrap;font:inherit}a{color:#3d7a16}</style></head>
<body><main><pre>${escapeHtml(markdown)}</pre></main></body></html>`;
  fs.writeFileSync(path.join(outputDir, output), html);
}
