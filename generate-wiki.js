const fs = require('fs');
const path = require('path');

// === Inline Parser (no external file needed) ===
function parseUserScriptHeader(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const header = {};

        const regex = /@(\w+)\s+(.+)/g;
        let match;

        while ((match = regex.exec(content)) !== null) {
            const key = match[1].toLowerCase();
            header[key] = match[2].trim();
        }

        if (!header.name) {
            header.name = path.basename(filePath).replace('.user.js', '').replace(/-/g, ' ');
        }
        if (!header.description) header.description = 'No description provided.';
        if (!header.author) header.author = 'Unknown';
        if (!header.version) header.version = '1.0.0';

        return {
            name: header.name,
            description: header.description,
            author: header.author,
            version: header.version
        };
    } catch (err) {
        return {
            name: path.basename(filePath),
            description: 'Error reading file',
            author: 'Unknown',
            version: '1.0.0'
        };
    }
}
// === End of Parser ===

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

// --- Home.md ---
let homeContent = `# CCO Scripts Archive\n\n`;
homeContent += `**The open-source userscript collection for [Case Clicker Online](https://case-clicker.com/).**\n\n`;
homeContent += `[![Last Updated](https://img.shields.io/github/last-commit/rowkav09/CCO-scripts-archive)](https://github.com/rowkav09/CCO-scripts-archive)\n`;
homeContent += `[![Stars](https://img.shields.io/github/stars/rowkav09/CCO-scripts-archive)](https://github.com/rowkav09/CCO-scripts-archive/stargazers)\n`;
homeContent += `[![License](https://img.shields.io/github/license/rowkav09/CCO-scripts-archive)](LICENSE)\n\n`;
homeContent += `---\n\n### Quick Start\n\n1. Install **Tampermonkey** or **Violentmonkey**\n2. Click **Raw** on any ".user.js" file to install\n\n---\n\n### Script Categories\n\n| Category           | Description                                      | Folder |\n|--------------------|--------------------------------------------------|--------|\n| **Auto Farming**   | Auto clickers, openers, sellers, and farms       | [scripts/auto-farm](../scripts/auto-farm) |\n| **Quality of Life**| UI/UX improvements and shortcuts                 | [scripts/QoL](../scripts/QoL) |\n| **Pricing**        | Price checkers and item value tools              | [scripts/pricing](../scripts/pricing) |\n| **Utilities**      | Export tools, stats, analyzers                   | [scripts/utilities](../scripts/utilities) |\n| **Misc**           | Other useful or experimental scripts             | [scripts/misc](../scripts/misc) |\n\n---\n\n<!-- LEADERBOARD_START -->\n### Top Contributors\n\n| Rank | Author | Scripts |\n|------|--------|---------|\n| 1    | Zhiro  | 3       |\n<!-- LEADERBOARD_END -->\n\n---\n\n### Most Popular Scripts\n\nThese are the **top 3 most used / recommended** scripts based on community feedback and downloads:\n\n1. **[Auto Farm Pro](../scripts/auto-farm/auto-farm-pro.user.js)** — Best all-in-one auto clicker + opener\n2. **[Smart Case Opener](../scripts/auto-farm/smart-opener.user.js)** — Opens cases efficiently with logic\n3. **[Live Price Checker](../scripts/pricing/live-price-checker.user.js)** — Real-time item valuation\n\n> *Want your script here? Make it high quality and get community feedback!*\n\n---\n\n### How to Install\n\n1. Install [Tampermonkey](https://www.tampermonkey.net/)\n2. Go to any ".user.js" file\n3. Click the **Raw** button\n4. Tampermonkey will prompt to install\n\n---\n\n### How to Contribute\n\nWe welcome all contributions!  \nSee **[CONTRIBUTING.md](../CONTRIBUTING.md)** for details.\n\n---\n\n### Wiki\n\nFor easier browsing and detailed documentation, check the **[Wiki](https://github.com/rowkav09/CCO-scripts-archive/wiki)**.\n\n---\n\n**Made with ❤️ for the Case Clicker community**\n\n---\n\n### Browse by Category\n\n""`;
homeContent += `---\n\n### Quick Start\n\n1. Install **Tampermonkey** or **Violentmonkey**\n2. Click **Raw** on any \`.user.js\` file to install\n\n---\n\n### Script Categories\n\n| Category           | Description                                      | Folder |\n|--------------------|--------------------------------------------------|--------|\n| **Auto Farming**   | Auto clickers, openers, sellers, and farms       | [scripts/auto-farm](../scripts/auto-farm) |\n| **Quality of Life**| UI/UX improvements and shortcuts                 | [scripts/QoL](../scripts/QoL) |\n| **Pricing**        | Price checkers and item value tools              | [scripts/pricing](../scripts/pricing) |\n| **Utilities**      | Export tools, stats, analyzers                   | [scripts/utilities](../scripts/utilities) |\n| **Misc**           | Other useful or experimental scripts             | [scripts/misc](../scripts/misc) |\n\n---\n\n<!-- LEADERBOARD_START -->\n### Top Contributors\n\n| Rank | Author | Scripts |\n|------|--------|---------|\n| 1    | Zhiro  | 3       |\n<!-- LEADERBOARD_END -->\n\n---\n\n### Most Popular Scripts\n\nThese are the **top 3 most used / recommended** scripts based on community feedback and downloads:\n\n1. **[Auto Farm Pro](../scripts/auto-farm/auto-farm-pro.user.js)** — Best all-in-one auto clicker + opener\n2. **[Smart Case Opener](../scripts/auto-farm/smart-opener.user.js)** — Opens cases efficiently with logic\n3. **[Live Price Checker](../scripts/pricing/live-price-checker.user.js)** — Real-time item valuation\n\n> *Want your script here? Make it high quality and get community feedback!*\n\n---\n\n### How to Install\n\n1. Install [Tampermonkey](https://www.tampermonkey.net/)\n2. Go to any \`.user.js\` file\n3. Click the **Raw** button\n4. Tampermonkey will prompt to install\n\n---\n\n### How to Contribute\n\nWe welcome all contributions!  \nSee **[CONTRIBUTING.md](../CONTRIBUTING.md)** for details.\n\n---\n\n### Wiki\n\nFor easier browsing and detailed documentation, check the **[Wiki](https://github.com/rowkav09/CCO-scripts-archive/wiki)**.\n\n---\n\n**Made with ❤️ for the Case Clicker community**\n\n---\n\n### Browse by Category\n\n""`;

// --- Category Pages ---
const categoryTips = {
    'auto-farm': [
        'Most scripts work well together',
        'Enable only 2-3 at a time to avoid conflicts',
        'Check individual script settings at the top of each file'
    ],
    'QoL': [
        'UI/UX scripts can be combined for best experience',
        'Disable scripts if you notice UI glitches'
    ],
    'pricing': [
        'Always check for latest prices',
        'Combine with utilities for best results'
    ],
    'utilities': [
        'Export and analyze your stats regularly',
        'Some utilities may require additional permissions'
    ],
    'misc': [
        'Experimental scripts may break or change frequently',
        'Use at your own risk!'
    ]
};

for (const [folder, title] of Object.entries(categories)) {
    const dirPath = path.join('scripts', folder);
    if (!fs.existsSync(dirPath)) continue;

    // --- Category Page Header ---
    let categoryContent = `# ${title.replace(/-/g, ' ')}

Scripts designed to help you with ${title.replace(/-/g, ' ').toLowerCase()}.

---

### Available Scripts

| Script Name | Description | Author | Last Updated | Install |
|-------------|-------------|--------|--------------|---------|
`;

    const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.user.js'))
        .sort();

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const info = parseUserScriptHeader(filePath);
        const stats = fs.statSync(filePath);
        const lastUpdated = stats.mtime.toISOString().slice(0, 7); // YYYY-MM
        const repoUrl = `https://github.com/rowkav09/CCO-scripts-archive/blob/main/scripts/${folder}/${file}`;
        const rawUrl = `https://raw.githubusercontent.com/rowkav09/CCO-scripts-archive/main/scripts/${folder}/${file}`;
        categoryContent += `| [${info.name}](${repoUrl}) | ${info.description} | ${info.author} | ${lastUpdated} | [Raw](${rawUrl}) |
`;
    }

    categoryContent += `

---

### Tips for This Category

`;
    (categoryTips[folder] || []).forEach(tip => {
        categoryContent += `- ${tip}
`;
    });

    categoryContent += `

---

**Back to [[Home]]`
;
    fs.writeFileSync(path.join(wikiDir, `${title}.md`), categoryContent);
}

fs.writeFileSync(path.join(wikiDir, 'Home.md'), homeContent);

console.log('Wiki pages generated successfully!');