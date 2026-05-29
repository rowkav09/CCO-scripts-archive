const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const WIKI_DIR = path.join(__dirname, 'wiki');

const CATEGORY_MAP = {
  'auto-farm': 'Auto Farming',
  'quality-of-life': 'Quality of Life',
  'pricing': 'Pricing',
  'utilities': 'Utilities',
  'misc': 'Misc',
  'enhancements': 'Enhancements'
};

const CATEGORY_DESC = {
  'auto-farm': 'Auto clickers, openers, and sellers',
  'quality-of-life': 'UI improvements and shortcuts',
  'pricing': 'Price checkers and value tools',
  'utilities': 'Export tools, stats, and analyzers',
  'misc': 'Other useful scripts',
  'enhancements': 'Visual and feature enhancements'
};

function main() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error("Scripts directory not found!");
    return;
  }

  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });

  const categories = fs.readdirSync(SCRIPTS_DIR)
    .filter(dir => fs.statSync(path.join(SCRIPTS_DIR, dir)).isDirectory());

  let totalScripts = 0;

  let content = `# CCO Scripts Archive - Wiki\n\n`;
  content += `**Central hub to discover all open-source scripts for Case Clicker Online.**\n\n`;
  content += `**Last Updated:** Auto-updated on each change  \n`;
  content += `**Total Scripts:** 5\n\n`;

  content += `### Script Categories\n\n`;
  content += `| Category | Description | Scripts | Browse |\n`;
  content += `|----------|-------------|---------|--------|\n`;

  for (const cat of categories) {
    const catDir = path.join(SCRIPTS_DIR, cat);
    const count = fs.readdirSync(catDir).filter(f => f.endsWith('.js')).length;
    totalScripts += count;

    const title = CATEGORY_MAP[cat.toLowerCase()] || cat;
    const desc = CATEGORY_DESC[cat.toLowerCase()] || 'Various scripts';

    content += `| **${title}** | ${desc} | ${count} | [[${title}]] |\n`;
  }

  content += `\n---\n\n**Made with ❤️ for the Case Clicker community**`;

  fs.writeFileSync(path.join(WIKI_DIR, 'Home.md'), content);
  console.log('✅ Home.md updated with consistent links');
}

main();