const fs = require('fs');
const path = require('path');
const { parseUserScriptHeader } = require('./parse-header.cjs');

const categories = {
  'auto-farm': 'Auto-Farming',
  'QoL': 'Quality-of-Life',
  'pricing': 'Pricing',
  'utilities': 'Utilities',
  'misc': 'Misc'
};

const scriptsDir = 'scripts';
const homePath = path.join('wiki', 'Home.md');

function countScripts(folder) {
  const dirPath = path.join(scriptsDir, folder);
  if (!fs.existsSync(dirPath)) return 0;
  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.js') && f !== 'index.js' && !f.startsWith('.')).length;
}

function updateCategoriesSection(homeContent) {
  const START_MARKER = '<!-- CATEGORIES_START -->';
  const END_MARKER = '<!-- CATEGORIES_END -->';

  const start = homeContent.indexOf(START_MARKER);
  const end = homeContent.indexOf(END_MARKER);

  if (start === -1 || end === -1) {
    console.warn('Warning: CATEGORIES_START/END markers not found in Home.md — no changes made.');
    return homeContent;
  }

  const before = homeContent.slice(0, start + START_MARKER.length);
  const after = homeContent.slice(end);

  const rows = [
    ['Auto Farming',    'Auto clickers, openers, and sellers', 'auto-farm', 'Auto-Farming'],
    ['Quality of Life', 'UI improvements and shortcuts',        'QoL',       'Qol'],
    ['Pricing',         'Price checkers and value tools',       'pricing',   'Pricing'],
    ['Utilities',       'Export tools, stats, and analyzers',   'utilities', 'Utilities'],
    ['Misc',            'Other useful scripts',                 'misc',      'Misc'],
  ];

  let table = '\n| Category | Description | Scripts | Browse |\n|----------|-------------|---------|--------|\n';
  for (const [label, desc, folder, wikiPage] of rows) {
    const count = countScripts(folder);
    table += `| **${label}** | ${desc} | ${count} | [[${wikiPage}]] |\n`;
  }

  return before + table + after;
}

function main() {
  if (!fs.existsSync(homePath)) {
    console.error(`Error: ${homePath} not found. Make sure wiki/Home.md exists in the repo.`);
    process.exit(1);
  }

  const homeContent = fs.readFileSync(homePath, 'utf8');
  const updated = updateCategoriesSection(homeContent);

  if (updated !== homeContent) {
    fs.writeFileSync(homePath, updated);
    console.log('Script Categories section updated in wiki/Home.md');
  } else {
    console.log('No changes made.');
  }
}

main();
