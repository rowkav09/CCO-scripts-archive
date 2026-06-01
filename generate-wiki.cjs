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
    browseLabel: 'Auto-Farming',
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
const WIKI_FILES = new Set(['Home.md', 'Leaderboard.md', ...CATEGORY_SPECS.map(spec => spec.page)]);
const BROKEN_ISSUE_TEMPLATE = 'script-not-working.yml';

function isScriptFile(file) {
  return (file.endsWith('.js') || file.endsWith('.user.js')) && file !== 'index.js' && !file.startsWith('.');
}

function collectScriptFiles(dirPath, relativeDir = '') {
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .flatMap(entry => {
      if (entry.name.startsWith('.')) {
        return [];
      }

      const entryPath = path.join(dirPath, entry.name);
      const entryRelativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        return collectScriptFiles(entryPath, entryRelativePath);
      }

      if (!isScriptFile(entry.name)) {
        return [];
      }

      return [{ filePath: entryPath, relativePath: entryRelativePath }];
    });
}

function resolveCategoryDir(folder) {
  const exactPath = path.join(SCRIPTS_DIR, folder);
  if (fs.existsSync(exactPath)) {
    return { dirName: folder, dirPath: exactPath };
  }

  const match = fs.readdirSync(SCRIPTS_DIR).find(entry => {
    const entryPath = path.join(SCRIPTS_DIR, entry);
    return fs.statSync(entryPath).isDirectory() && entry.toLowerCase() === folder.toLowerCase();
  });

  if (!match) {
    return null;
  }

  return { dirName: match, dirPath: path.join(SCRIPTS_DIR, match) };
}

function readScripts(folder) {
  const category = resolveCategoryDir(folder);

  if (!category) return [];

  return collectScriptFiles(category.dirPath)
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    .map(({ filePath, relativePath }) => {
      const header = parseUserScriptHeader(filePath);
      const urlPath = path.join('scripts', folder, relativePath).replace(/\\/g, '/');
      const url = `https://github.com/rowkav09/CCO-scripts-archive/blob/main/${urlPath}`;
      const brokenUrl = buildBrokenIssueUrl({
        scriptName: header.name,
        scriptUrl: url,
        category: folder
      });

      return {
        row: `| [${header.name}](${url}) | ${header.description} | ${header.author} | ${header.version} |`,
        brokenUrl
      };
    });
}

function buildBrokenIssueUrl({ scriptName, scriptUrl, category }) {
  const title = encodeURIComponent(`[Broken] ${scriptName}`);
  const body = encodeURIComponent(
    `Submit this only if the script is not working.\n\nPlease test it properly before opening the issue.\n\nTag @rowka and I will confirm whether it works or not by reacting with works or doesnt.\n\n**Script:** [${scriptName}](${scriptUrl})\n**Category:** ${category}\n\n**What is broken?**\n`
  );

  return `https://github.com/rowkav09/CCO-scripts-archive/issues/new?template=${BROKEN_ISSUE_TEMPLATE}&title=${title}&body=${body}`;
}

function buildCategoryPage(spec) {
  const rows = readScripts(spec.folder);
  const scriptCount = rows.length;

  let content = `# ${spec.title}\n\n`;
  content += `**${spec.description}**\n\n`;
  content += `**Total Scripts:** ${scriptCount}\n\n`;
  content += `| Script Name | Description | Author | Latest Version | Rating | Report Broken |\n`;
  content += `|-------------|-------------|--------|----------------|--------|--------------|\n`;

  if (rows.length === 0) {
     content += `| _No scripts found_ | _No scripts found_ | _No scripts found_ | _No scripts found_ | _No scripts found_ | _No scripts found_ |\n`;
  } else {
    content += `${rows.map(({ row, brokenUrl }) => `${row} — | [Report Broken](${brokenUrl}) |`).join('\n')}\n`;
  }

  return { content, scriptCount };
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
    pageRows.push(`| **${spec.title}** | ${spec.description} | [[${spec.browseLabel}]] |`);
    console.log(`✅ ${spec.page} updated`);
  }

  let homeContent = `# CCO Scripts Archive - Wiki\n\n`;
  homeContent += `**Browse the scripts by category and jump straight to the relevant wiki page.**\n\n`;
  homeContent += `### Leaderboard\n\n`;
  homeContent += `See the full repository ranking, including scripts with no votes, on the [[Leaderboard]] page.\n\n`;
  homeContent += `**Last Updated:** Auto-updated on each change  \n`;
  homeContent += `**Total Scripts:** ${totalScripts}\n\n`;
  homeContent += `### Categories\n\n`;
  homeContent += `| Category | Description | Browse |\n`;
  homeContent += `|----------|-------------|--------|\n`;
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