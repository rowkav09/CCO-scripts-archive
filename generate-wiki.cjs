const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '../scripts');   // Adjusted path
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
      name: header.name || path.basename(filePath),
      description: header.description || 'No description provided.',
      author: header.author || 'Unknown',
      version: header.version || '1.0'
    };
  } catch (e) {
    return { name: path.basename(filePath), description: 'Error reading file', author: 'Unknown', version: '1.0' };
  }
}

function main() {
  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });

  const categories = fs.readdirSync(SCRIPTS_DIR).filter(dir => 
    fs.statSync(path.join(SCRIPTS_DIR, dir)).isDirectory()
  );

  let homeContent = `# CCO Scripts Archive - Wiki\n\n`;
  homeContent += `![Last Updated](https://img.shields.io/github/last-commit/rowkav09/CCO-scripts-archive)\n\n`;
  homeContent += `### Script Categories\n\n`;
  homeContent += `| Category | Scripts | Browse |\n|----------|---------|--------|\n`;

  for (const cat of categories) {
    const catDir = path.join(SCRIPTS_DIR, cat);
    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.js'));

    const title = CATEGORY_MAP[cat.toLowerCase()] || cat;
    homeContent += `| **${title}** | ${files.length} | [[${title}]] |\n`;

    // Generate category page
    let content = `# ${title}\n\n`;
    content += `Auto-generated on ${new Date().toISOString().split('T')[0]}\n\n`;
    content += `| Script Name | Description | Author | Version |\n`;
    content += `|-------------|-------------|--------|---------|\n`;

    for (const file of files) {
      const meta = parseHeader(path.join(catDir, file));
      const rawUrl = `https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/${cat}/${file}`;
      content += `| [${meta.name}](${file}) | ${meta.description} | ${meta.author} | ${meta.version} |\n`;
    }

    fs.writeFileSync(path.join(WIKI_DIR, `${title}.md`), content);
  }

  fs.writeFileSync(path.join(WIKI_DIR, 'Home.md'), homeContent);
  console.log('✅ Wiki generated successfully');
}

main();