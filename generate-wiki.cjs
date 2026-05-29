const fs = require('fs');
const path = require('path');

// FIXED: Correct path when script is in repository root
const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const WIKI_DIR = path.join(__dirname, 'wiki');

console.log("🔍 Debug:");
console.log("Current directory:", __dirname);
console.log("Looking for scripts at:", SCRIPTS_DIR);
console.log("Scripts folder exists?", fs.existsSync(SCRIPTS_DIR));

const CATEGORY_MAP = {
  'auto-farm': 'Auto Farming',
  'qol': 'Quality of Life',
  'pricing': 'Pricing',
  'utilities': 'Utilities',
  'misc': 'Misc',
  'enhancements': 'Enhancements'
};

const CATEGORY_DESC = {
  'auto-farm': 'Auto clickers, openers, and sellers',
  'qol': 'UI improvements and shortcuts',
  'pricing': 'Price checkers and value tools',
  'utilities': 'Export tools, stats, and analyzers',
  'misc': 'Other useful scripts',
  'enhancements': 'Visual and feature enhancements'
};

function main() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error("❌ Scripts directory not found at:", SCRIPTS_DIR);
    return;
  }

  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });

  const categories = fs.readdirSync(SCRIPTS_DIR)
    .filter(dir => fs.statSync(path.join(SCRIPTS_DIR, dir)).isDirectory());

  console.log("✅ Found categories:", categories);

  let totalScripts = 0;

  let content = `# CCO Scripts Archive - Wiki\n\n`;
  content += `**Central hub to discover all open-source scripts for Case Clicker Online.**\n\n`;
  content += `![Last Updated](https://img.shields.io/github/last-commit/rowkav09/CCO-scripts-archive)\n`;
  content += `![Total Scripts](https://img.shields.io/badge/Total%20Scripts-0-brightgreen)\n\n`;

  content += `### 📂 Script Categories\n\n`;
  content += `| Category | Description | Scripts | Browse |\n`;
  content += `|----------|-------------|---------|--------|\n`;

  for (const cat of categories) {
    const catDir = path.join(SCRIPTS_DIR, cat);
    const jsFiles = fs.readdirSync(catDir).filter(f => f.endsWith('.js'));
    const count = jsFiles.length;
    totalScripts += count;

    const title = CATEGORY_MAP[cat.toLowerCase()] || cat;
    const desc = CATEGORY_DESC[cat.toLowerCase()] || 'Various scripts';

    content += `| **${title}** | ${desc} | ${count} | [[${title}]] |\n`;
    console.log(`   • ${title}: ${count} scripts`);
  }

  // Update total scripts badge
  content = content.replace(
    /Total%20Scripts-0-brightgreen/, 
    `Total%20Scripts-${totalScripts}-brightgreen`
  );

  fs.writeFileSync(path.join(WIKI_DIR, 'Home.md'), content);

  console.log(`\n✅ Successfully generated! Total scripts: ${totalScripts}`);
}

main();