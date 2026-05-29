const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '../scripts');
const WIKI_DIR = path.join(__dirname, '../wiki');

console.log("🔍 Starting Wiki Generator Debug");
console.log("Scripts directory:", SCRIPTS_DIR);
console.log("Exists?", fs.existsSync(SCRIPTS_DIR));

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
    console.error("❌ Scripts folder not found!");
    return;
  }

  const categories = fs.readdirSync(SCRIPTS_DIR)
    .filter(dir => fs.statSync(path.join(SCRIPTS_DIR, dir)).isDirectory());

  console.log("📂 Found categories:", categories);

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
    console.log(`\nChecking folder: scripts/${cat}`);

    let files = fs.readdirSync(catDir);
    console.log(`  All files found:`, files);

    const jsFiles = files.filter(f => f.endsWith('.js'));
    console.log(`  .js files found:`, jsFiles);

    const count = jsFiles.length;
    totalScripts += count;

    const title = CATEGORY_MAP[cat.toLowerCase()] || cat;

    content += `| **${title}** | Scripts for ${cat} | ${count} | [[${title}]] |\n`;

    console.log(`  → ${title}: ${count} scripts`);
  }

  content = content.replace(
    /Total%20Scripts-0-brightgreen/, 
    `Total%20Scripts-${totalScripts}-brightgreen`
  );

  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });
  fs.writeFileSync(path.join(WIKI_DIR, 'Home.md'), content);

  console.log(`\n✅ Finished! Total scripts counted: ${totalScripts}`);
}

main();