const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '../scripts');
const WIKI_DIR = path.join(__dirname, '../wiki');

console.log('🔍 Debug Info:');
console.log('Scripts directory path:', SCRIPTS_DIR);
console.log('Does scripts dir exist?', fs.existsSync(SCRIPTS_DIR));

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
    console.error("❌ Scripts directory not found at:", SCRIPTS_DIR);
    return;
  }

  const categories = fs.readdirSync(SCRIPTS_DIR).filter(dir => {
    const fullPath = path.join(SCRIPTS_DIR, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log('Found categories:', categories);

  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });

  let homeContent = `# CCO Scripts Archive - Wiki\n\n`;
  homeContent += `**Central hub to discover all open-source scripts for Case Clicker Online.**\n\n`;
  homeContent += `![Last Updated](https://img.shields.io/github/last-commit/rowkav09/CCO-scripts-archive)\n\n`;
  homeContent += `### Script Categories\n\n`;
  homeContent += `| Category | Description | Scripts | Browse |\n`;
  homeContent += `|----------|-------------|---------|--------|\n`;

  for (const cat of categories) {
    const catDir = path.join(SCRIPTS_DIR, cat);
    const files = fs.readdirSync(catDir)
                    .filter(f => f.endsWith('.js') || f.endsWith('.user.js'))
                    .sort();

    const scriptCount = files.length;
    console.log(`Category "${cat}": ${scriptCount} scripts found`);

    const title = CATEGORY_MAP[cat.toLowerCase()] || cat;

    homeContent += `| **${title}** | Scripts for ${cat} | ${scriptCount} | [[${title}]] |\n`;

    // Generate Category Page
    let catContent = `# ${title}\n\n`;
    catContent += `Auto-generated on ${new Date().toISOString().split('T')[0]}\n\n`;
    catContent += `| Script Name | Description | Author | Version | Install |\n`;
    catContent += `|-------------|-------------|--------|---------|---------|\n`;

    for (const file of files) {
      const meta = { name: file, description: 'No description', author: 'Unknown', version: '1.0' };
      const rawUrl = `https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/${cat}/${file}`;
      catContent += `| [${meta.name}](${file}) | ${meta.description} | ${meta.author} | ${meta.version} | [Install](${rawUrl}) |\n`;
    }

    fs.writeFileSync(path.join(WIKI_DIR, `${title}.md`), catContent);
  }

  fs.writeFileSync(path.join(WIKI_DIR, 'Home.md'), homeContent);
  console.log('✅ Wiki generated successfully!');
}

main();