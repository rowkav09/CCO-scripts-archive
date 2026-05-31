const fs = require('fs');
const path = require('path');

const categories = [
  { label: 'Auto-Farm', folder: 'auto-farm', wikiPage: 'Auto-Farming' },
  { label: 'Gaming', folder: 'gaming', wikiPage: 'Gaming' },
  { label: 'UI', folder: 'ui', wikiPage: 'UI' },
  { label: 'Enhancements', folder: 'enhancements', wikiPage: 'Enhancements' },
  { label: 'Bots', folder: 'bots', wikiPage: 'Bots' },
  { label: 'Utilities', folder: 'utilities', wikiPage: 'Utilities' }
];

const scriptsDir = 'scripts';
const homePath = path.join('wiki', 'Home.md');

function isScriptFile(file) {
  return (file.endsWith('.js') || file.endsWith('.user.js')) && file !== 'index.js' && !file.startsWith('.');
}

function collectScriptFiles(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .flatMap(entry => {
      if (entry.name.startsWith('.')) {
        return [];
      }

      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        return collectScriptFiles(entryPath);
      }

      return isScriptFile(entry.name) ? [entryPath] : [];
    });
}

function countScripts(folder) {
  const dirPath = path.join(scriptsDir, folder);
  if (!fs.existsSync(dirPath)) return 0;
  return collectScriptFiles(dirPath).length;
}

function updateCategoriesSection(homeContent) {
  const START_MARKER = '<!-- CATEGORIES_START -->';
  const END_MARKER = '<!-- CATEGORIES_END -->';

  const start = homeContent.indexOf(START_MARKER);
  const end = homeContent.indexOf(END_MARKER);

  if (start !== -1 && end !== -1 && end > start) {
    const before = homeContent.slice(0, start + START_MARKER.length);
    const after = homeContent.slice(end);

    const rows = [
      ['Auto-Farm', 'Scripts designed to automate repetitive actions, speed up grinding, bulk actions, or reduce manual gameplay effort.', 'auto-farm', 'Auto-Farming'],
      ['Gaming', 'Game-focused scripts that add custom game systems, improve existing modes, add statistics, or create entirely new gameplay experiences.', 'gaming', 'Gaming'],
      ['UI', 'Themes, overlays, interface redesigns, wallpapers, custom displays, and visual improvements for the client.', 'ui', 'UI'],
      ['Enhancements', 'Extra features and upgrades that improve the overall experience without fully fitting into other categories.', 'enhancements', 'Enhancements'],
      ['Bots', 'Scripts or systems that interact with external services, automated trading, deposits/withdrawals, or server-connected features.', 'bots', 'Bots'],
      ['Utilities', 'Helpful tools for pricing, tracking, chat features, float checking, inventory management, and general quality-of-life improvements.', 'utilities', 'Utilities']
    ];

    let table = '\n| Category | Description | Scripts | Browse |\n|----------|-------------|---------|--------|\n';
    for (const [label, desc, folder, wikiPage] of rows) {
      const count = countScripts(folder);
      table += `| **${label}** | ${desc} | ${count} | [[${wikiPage}]] |\n`;
    }

    return before + table + after;
  }

  const heading = homeContent.indexOf('### Categories');
  if (heading !== -1) {
    const sectionTail = homeContent.slice(heading);
    const nextSectionMatch = sectionTail.match(/\r?\n---\r?\n/);
    if (nextSectionMatch) {
      const nextSection = heading + nextSectionMatch.index;
      const before = homeContent.slice(0, heading);
      const after = homeContent.slice(nextSection);

      const rows = [
        ['Auto-Farm', 'Scripts designed to automate repetitive actions, speed up grinding, bulk actions, or reduce manual gameplay effort.', 'auto-farm', 'Auto-Farming'],
        ['Gaming', 'Game-focused scripts that add custom game systems, improve existing modes, add statistics, or create entirely new gameplay experiences.', 'gaming', 'Gaming'],
        ['UI', 'Themes, overlays, interface redesigns, wallpapers, custom displays, and visual improvements for the client.', 'ui', 'UI'],
        ['Enhancements', 'Extra features and upgrades that improve the overall experience without fully fitting into other categories.', 'enhancements', 'Enhancements'],
        ['Bots', 'Scripts or systems that interact with external services, automated trading, deposits/withdrawals, or server-connected features.', 'bots', 'Bots'],
        ['Utilities', 'Helpful tools for pricing, tracking, chat features, float checking, inventory management, and general quality-of-life improvements.', 'utilities', 'Utilities']
      ];

      let table = '### Categories\n\n| Category | Description | Scripts | Browse |\n|----------|-------------|---------|--------|\n';
      for (const [label, desc, folder, wikiPage] of rows) {
        const count = countScripts(folder);
        table += `| **${label}** | ${desc} | ${count} | [[${wikiPage}]] |\n`;
      }

      return before + table + after;
    }
  }

  console.warn('Warning: no known categories section found in Home.md — no changes made.');
  return homeContent;
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
