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

function parseHeader(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const header = {};
    const regex = /@(\w+)\s+(.+)/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      header[match[1].toLowerCase()] = match[2].trim();
    }

    return {
      name: header.name || path.basename(filePath).replace('.js', ''),
      description: header.description || 'No description provided.',
      author: header.author || 'Unknown',
      version: header.version || '1.0'
    };
  } catch (e) {
    return { name: path.basename(filePath), description: 'Error reading file', author: 'Unknown', version: '1.0' };
  }
}

function main() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error("Scripts directory not found!");
    return;
  }

  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });

  const categories = fs.readdirSync(SCRIPTS_DIR).filter(dir => 
    fs.statSync(path.join(SCRIPTS_DIR, dir)).isDirectory()
  );

  let homeContent = `# CCO Scripts Archive - Wiki\n\n`;
  homeContent += `**Central hub to discover all open-source scripts for Case Clicker Online.**\n\n`;
  homeContent += `![Last Updated](https://img.shields.io/github/last-commit/rowkav09/CCO-scripts-archive)\n\n`;
  homeContent += `### 📂 Script Categories\n\n`;
  homeContent += `| Category | Description | Scripts | Browse |\n`;
  homeContent += `|----------|-------------|---------|--------|\n`;

  for (const cat of categories) {
    const catDir = path.join(SCRIPTS_DIR, cat);
    const files = fs.readdirSync(catDir)
                    .filter(f => f.endsWith('.js'))
                    .sort();

    const scriptCount = files.length;
    const title = CATEGORY_MAP[cat.toLowerCase()] || cat.charAt(0).toUpperCase() + cat.slice(1);

    homeContent += `| **${title}** | ${CATEGORY_MAP[cat.toLowerCase()] ? 'Scripts for ' + cat : 'Various scripts'} | ${scriptCount} | [[${title}]] |\n`;

    // Generate Category Page
    let catContent = `# ${title}\n\n`;
    catContent += `Auto-generated on ${new Date().toISOString().split('T')[0]}\n\n`;
    catContent += `| Script Name | Description | Author | Version |\n`;
    catContent += `|-------------|-------------|--------|---------|\n`;

    for (const file of files) {
      const meta = parseHeader(path.join(catDir, file));
      const rawUrl = `https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/${cat}/${file}`;
      catContent += `| [${meta.name}](${file}) | ${meta.description} | ${meta.author} | ${meta.version} | [Install](${rawUrl}) |\n`;
    }

    fs.writeFileSync(path.join(WIKI_DIR, `${title}.md`), catContent);
  }

  fs.writeFileSync(path.join(WIKI_DIR, 'Home.md'), homeContent);
  console.log('✅ Wiki generated successfully with updated script counts!');
}

