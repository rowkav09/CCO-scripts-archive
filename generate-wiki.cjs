const fs = require('fs');
const path = require('path');
const { parseUserScriptHeader } = require('./parse-header.cjs');

const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const WIKI_DIR = path.join(__dirname, 'wiki');

const CATEGORY_SPECS = [
  {
    folder: 'auto-farm',
    page: 'Auto-Farming.md',
    title: 'Auto-Farm',
    browseLabel: 'Auto-Farm',
    description: 'Scripts designed to automate repetitive actions, speed up grinding, bulk actions, or reduce manual gameplay effort.'
  },
  {
    folder: 'gaming',
    page: 'Gaming.md',
    title: 'Gaming',
    browseLabel: 'Gaming',
    description: 'Game-focused scripts that add custom game systems, improve existing modes, add statistics, or create entirely new gameplay experiences.'
  },
  {
    folder: 'ui',
    page: 'UI.md',
    title: 'UI',
    browseLabel: 'UI',
    description: 'Themes, overlays, interface redesigns, wallpapers, custom displays, and visual improvements for the client.'
  },
  {
    folder: 'enhancements',
    page: 'Enhancements.md',
    title: 'Enhancements',
    browseLabel: 'Enhancements',
    description: 'Extra features and upgrades that improve the overall experience without fully fitting into other categories.'
  },
  {
    folder: 'bots',
    page: 'Bots.md',
    title: 'Bots',
    browseLabel: 'Bots',
    description: 'Scripts or systems that interact with external services, automated trading, deposits/withdrawals, or server-connected features.'
  },
  {
    folder: 'utilities',
    page: 'Utilities.md',
    title: 'Utilities',
    browseLabel: 'Utilities',
    description: 'Helpful tools for pricing, tracking, chat features, float checking, inventory management, and general quality-of-life improvements.'
  }
];

const CATEGORY_BY_FOLDER = new Map(CATEGORY_SPECS.map(spec => [spec.folder, spec]));
const WIKI_FILES = new Set(['Home.md', ...CATEGORY_SPECS.map(spec => spec.page)]);

function readScripts(folder) {
  const categoryDir = path.join(SCRIPTS_DIR, folder);

  if (!fs.existsSync(categoryDir)) return [];

  return fs.readdirSync(categoryDir)
    .filter(file => file.endsWith('.js') && !file.startsWith('.'))
    .sort((left, right) => left.localeCompare(right))
    .map(file => {
      const filePath = path.join(categoryDir, file);
      const header = parseUserScriptHeader(filePath);
      const relativePath = path.join('scripts', folder, file).replace(/\\/g, '/');
      const url = `https://github.com/rowkav09/CCO-scripts-archive/blob/main/${relativePath}`;

      return `| [${header.filename}](${url}) | ${header.description} | ${header.author} | ${header.version} |`;
    });
}

function buildCategoryPage(spec) {
  const rows = readScripts(spec.folder);

  let content = `# ${spec.title}\n\n`;
  content += `**${spec.description}**\n\n`;
  content += `| Script Name | Description | Author | Latest Version |\n`;
  content += `|-------------|-------------|--------|----------------|\n`;

  if (rows.length === 0) {
    content += `| _No scripts found_ | _No scripts found_ | _No scripts found_ | _No scripts found_ |\n`;
  } else {
    content += `${rows.join('\n')}\n`;
  }

  return { content, scriptCount: rows.length };
}

function cleanStaleWikiPages() {
  const existingPages = fs.readdirSync(WIKI_DIR).filter(file => file.endsWith('.md'));
  for (const file of existingPages) {
    if (!WIKI_FILES.has(file)) {
      fs.unlinkSync(path.join(WIKI_DIR, file));
    }
  }
}

function main() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error('Scripts directory not found!');
    return;
  }

  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });

  cleanStaleWikiPages();

  const pageRows = [];
  let totalScripts = 0;

  for (const spec of CATEGORY_SPECS) {
    const { content, scriptCount } = buildCategoryPage(spec);
    fs.writeFileSync(path.join(WIKI_DIR, spec.page), content);

    totalScripts += scriptCount;
    pageRows.push(`| **${spec.title}** | ${spec.description} | ${scriptCount} | [[${spec.browseLabel}]] |`);
    console.log(`✅ ${spec.page} updated`);
  }

  let homeContent = `# CCO Scripts Archive - Wiki\n\n`;
  homeContent += `**Browse the scripts by category and jump straight to the relevant wiki page.**\n\n`;
  homeContent += `**Last Updated:** Auto-updated on each change  \n`;
  homeContent += `**Total Scripts:** ${totalScripts}\n\n`;
  homeContent += `### Categories\n\n`;
  homeContent += `| Category | Description | Scripts | Browse |\n`;
  homeContent += `|----------|-------------|---------|--------|\n`;
  homeContent += `${pageRows.join('\n')}\n`;
  homeContent += `\n---\n\n**Made with ❤️ for the Case Clicker community**`;

  fs.writeFileSync(path.join(WIKI_DIR, 'Home.md'), homeContent);
  console.log('✅ Home.md updated with consistent links');

  for (const file of fs.readdirSync(WIKI_DIR)) {
    if (file.endsWith('.md') && !WIKI_FILES.has(file)) {
      fs.unlinkSync(path.join(WIKI_DIR, file));
    }
  }
}

main();