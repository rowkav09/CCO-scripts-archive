const fs = require('fs');
const path = require('path');
const { parseUserScriptHeader } = require('../../scripts/utils/parse-header.js');

const categories = {
  'auto-farm': 'Auto-Farming',
  'QoL': 'Quality-of-Life',
  'pricing': 'Pricing',
  'utilities': 'Utilities',
  'misc': 'Misc'
};

const wikiDir = 'wiki';

// Ensure wiki directory exists
if (!fs.existsSync(wikiDir)) fs.mkdirSync(wikiDir, { recursive: true });

// Generate Home.md
let homeContent = `# CCO Scripts Archive - Wiki\n\n`;
homeContent += `![Last Updated](https://img.shields.io/github/last-commit/rowkav09/CCO-scripts-archive)\n\n`;
homeContent += `### Script Categories\n\n`;
homeContent += `| Category | Description | Browse |\n`;
homeContent += `|----------|-------------|--------|\n`;

for (const [folder, title] of Object.entries(categories)) {
    const dirPath = path.join('scripts', folder);
    if (!fs.existsSync(dirPath)) continue;

    homeContent += `| **${title}** | Scripts for ${folder} | [[${title}]] |\n`;

    // Generate individual category page
    let categoryContent = `# ${title}\n\n`;
    categoryContent += `Auto-generated on ${new Date().toISOString().split('T')[0]}\n\n`;
    categoryContent += `| Script | Description | Author | Version | Install |\n`;
    categoryContent += `|--------|-------------|--------|---------|---------|\n`;

    const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.user.js'))
        .sort();

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const info = parseUserScriptHeader(filePath);

        const rawUrl = `https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/${folder}/${file}`;

        categoryContent += `| [${info.name}](${file}) | ${info.description} | ${info.author} | ${info.version} | [Install](${rawUrl}) |\n`;
    }

    fs.writeFileSync(path.join(wikiDir, `${title}.md`), categoryContent);
}

fs.writeFileSync(path.join(wikiDir, 'Home.md'), homeContent);

console.log('Wiki pages generated successfully!');