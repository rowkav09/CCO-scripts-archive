const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '../scripts');
const WIKI_DIR = path.join(__dirname, '../wiki');

const CATEGORY_MAP = {
  'auto-farm': 'Auto Farming',
  'qol': 'Quality of Life',
  'pricing': 'Pricing',
  'utilities': 'Utilities',
  'misc': 'Misc',
  'enhancements': 'Enhancements'
};

function main() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error("❌ Scripts directory not found!");
    return;
  }

  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });

  const categories = fs.readdirSync(SCRIPTS_DIR)
    .filter(dir => fs.statSync(path.join(SCRIPTS_DIR, dir)).isDirectory());

  let totalScripts = 0;
  const categoryData = {};

  // Count scripts per category
  for (const cat of categories) {
    const catDir = path.join(SCRIPTS_DIR, cat);
    const files = fs.readdirSync(catDir)
                    .filter(f => f.endsWith('.js'));
    categoryData[cat] = {
      count: files.length,
      title: CATEGORY_MAP[cat.toLowerCase()] || cat
    };
    totalScripts += files.length;
  }

  // === Generate Home.md with updated counts ===
  let homeContent = `# CCO Scripts Archive - Wiki\n\n`;
  homeContent += `**Central hub to discover all open-source scripts for Case Clicker Online.**\n\n`;
  homeContent += `![Last Updated](https://img.shields.io/github/last-commit/rowkav09/CCO-scripts-archive)\n`;
  homeContent += `![Total Scripts](https://img.shields.io/badge/Total%20Scripts-${totalScripts}-brightgreen)\n\n`;

  homeContent += `### Script Categories\n\n`;
  homeContent += `| Category | Description | Scripts | Browse |\n`;
  homeContent += `|----------|-------------|---------|--------|\n`;

  for (const cat of categories) {
    const data = categoryData[cat];
    const desc = data.title.includes('Farming') ? 'Auto clickers, openers, and sellers' :
                 data.title.includes('Life') ? 'UI improvements and shortcuts' :
                 data.title.includes('Pricing') ? 'Price checkers and value tools' :
                 data.title.includes('Utilities') ? 'Export tools, stats, and analyzers' : 'Other useful scripts';

    homeContent += `| **${data.title}** | ${desc} | ${data.count} | [[${data.title}]] |\n`;
  }

  homeContent += `\n---\n\n`;
  homeContent += `**Made with ❤️ for the Case Clicker community** · [← Back to Repository](https://github.com/rowkav09/CCO-scripts-archive)`;

  fs.writeFileSync(path.join(WIKI_DIR, 'Home.md'), homeContent);

  console.log(`✅ Wiki generated! Total Scripts: ${totalScripts}`);
  console.log('Category counts updated successfully.');
}

main();