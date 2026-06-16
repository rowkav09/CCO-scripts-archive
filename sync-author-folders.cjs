#!/usr/bin/env node
// sync-author-folders.cjs
// Scans all scripts for @author tag and mirrors them into authors/<name>/ folders.
// These folders are purely for browsing — they are intentionally excluded from
// all vote/leaderboard/wiki logic.

const fs   = require('fs');
const path = require('path');

const SCRIPTS_DIR = 'scripts';
const AUTHORS_DIR = 'authors';

// ── helpers ──────────────────────────────────────────────────────────────────

function extractAuthor(content) {
  const match = content.match(/^\/\/\s*@author\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function safeDir(name) {
  // Sanitise author name to be a safe folder name
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim().replace(/\s+/g, '_') || 'Unknown';
}

function getAllScripts(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip the authors folder itself if it ends up inside scripts somehow
      results.push(...getAllScripts(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

// ── main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SCRIPTS_DIR)) {
  console.error(`scripts/ directory not found`);
  process.exit(1);
}

// Wipe and rebuild authors dir from scratch so removed scripts are cleaned up
if (fs.existsSync(AUTHORS_DIR)) {
  fs.rmSync(AUTHORS_DIR, { recursive: true, force: true });
}

const scriptFiles = getAllScripts(SCRIPTS_DIR);
console.log(`Found ${scriptFiles.length} scripts`);

const authorMap = {}; // authorDir -> [{ src, filename }]

for (const src of scriptFiles) {
  const content = fs.readFileSync(src, 'utf8');
  const author  = extractAuthor(content);
  if (!author) {
    console.log(`  [skip] no @author: ${src}`);
    continue;
  }
  const dir = safeDir(author);
  if (!authorMap[dir]) authorMap[dir] = [];
  authorMap[dir].push({ src, filename: path.basename(src) });
}

for (const [authorDir, files] of Object.entries(authorMap)) {
  const dest = path.join(AUTHORS_DIR, authorDir);
  fs.mkdirSync(dest, { recursive: true });

  // Write a README so the folder shows up nicely on GitHub
  const readmeLines = [
    `# Scripts by ${authorDir.replace(/_/g, ' ')}`,
    '',
    '> This folder is auto-generated. Edit scripts in `scripts/` — changes here will be overwritten.',
    '',
    '| Script | Category |',
    '|--------|----------|',
  ];

  for (const { src, filename } of files) {
    // category = second path segment e.g. scripts/enhancements/foo.js -> enhancements
    const parts    = src.split(path.sep);
    const category = parts.length > 2 ? parts[1] : '—';
    const repoPath = src.replace(/\\/g, '/');
    readmeLines.push(`| [\`${filename}\`](../../${repoPath}) | ${category} |`);
    fs.copyFileSync(src, path.join(dest, filename));
    console.log(`  [copy] ${src} -> ${dest}/${filename}`);
  }

  fs.writeFileSync(path.join(dest, 'README.md'), readmeLines.join('\n') + '\n');
  console.log(`  [readme] ${dest}/README.md`);
}

// Top-level authors/README.md listing all authors
const topLines = [
  '# Authors',
  '',
  '> Auto-generated — do not edit directly.',
  '',
  '| Author | Scripts |',
  '|--------|---------|',
];
for (const [authorDir, files] of Object.entries(authorMap).sort()) {
  topLines.push(`| [${authorDir.replace(/_/g, ' ')}](./${authorDir}/) | ${files.length} |`);
}
fs.mkdirSync(AUTHORS_DIR, { recursive: true });
fs.writeFileSync(path.join(AUTHORS_DIR, 'README.md'), topLines.join('\n') + '\n');

console.log(`\nDone — ${Object.keys(authorMap).length} author folder(s) written to ${AUTHORS_DIR}/`);
