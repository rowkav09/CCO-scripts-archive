const fs = require('fs');
const path = require('path');

// Category mapping for output filenames
const CATEGORY_MAP = {
  'auto-farm': 'Auto-Farming.md',
  'qol': 'Qol.md',
  'utilities': 'Utilities.md',
  'enhancements': 'Enhancements.md',
  'misc': 'Misc.md',
  'pricing': 'Pricing.md',
};

const CATEGORY_DESCRIPTIONS = {
  'auto-farm': 'Scripts for automatic farming and resource collection.',
  'qol': 'Quality of Life scripts to enhance your experience.',
  'utilities': 'Scripts designed for tools, helpers, and general-purpose functions.',
  'enhancements': 'Scripts that enhance or add new features.',
  'misc': 'Miscellaneous scripts that do not fit other categories.',
  'pricing': 'Scripts related to pricing, value, and market analysis.',
};

// Files that should never be deleted by this script
const PROTECTED_FILES = new Set(['Home.md']);

const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const WIKI_DIR = path.join(__dirname, 'wiki');
const REPO_URL = 'https://github.com/rowkav09/CCO-scripts-archive/blob/main/scripts';


function getCategoryFileName(category) {
  const normalized = category.toLowerCase();
  return CATEGORY_MAP[normalized] || `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}.md`;
}

function getCategoryDescription(category) {
  return CATEGORY_DESCRIPTIONS[category.toLowerCase()] || 'Scripts for this category.';
}

function extractMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let description = '';
  let author = 'Unknown';
  let version = '1.0';
  let foundDescription = false;

  for (const line of lines) {
    const descMatch = line.match(/@description\s+(.+)/i);
    if (descMatch) {
      description = descMatch[1].trim();
      foundDescription = true;
    }
    const authorMatch = line.match(/@author\s+(.+)/i);
    if (authorMatch) author = authorMatch[1].trim();
    const versionMatch = line.match(/@version\s+([\w.\-]+)/i);
    if (versionMatch) version = versionMatch[1].trim();
    if (foundDescription && author !== 'Unknown' && version !== '1.0') break;
  }

  if (!description) {
    // Fallback: first non-empty comment line
    for (const line of lines) {
      const commentMatch = line.match(/^\s*\/\/[\s#]*([^@].+)/) || line.match(/^\s*#[\s#]*([^@].+)/);
      if (commentMatch) {
        description = commentMatch[1].trim();
        break;
      }
    }
  }

  if (!description) description = 'No description.';
  return { description, author, version };
}

function scanScriptsForCategories(baseDir) {
  // Only scan direct subfolders as categories
  const categories = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  const scriptsByCategory = {};
  for (const category of categories) {
    const catDir = path.join(baseDir, category);
    const entries = fs.readdirSync(catDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(catDir, entry.name);
        const meta = extractMetadata(fullPath);
        if (!scriptsByCategory[category]) scriptsByCategory[category] = [];
        scriptsByCategory[category].push({
          name: entry.name,
          category: category.toLowerCase(),
          path: fullPath,
          relPath: path.relative(SCRIPTS_DIR, fullPath).replace(/\\/g, '/'),
          ...meta,
        });
      }
    }
  }
  return scriptsByCategory;
}

function generateTable(scripts) {
  let table = `| Script Name | Description | Author | Latest Version | Votes |\n|-------------|-------------|--------|----------------|-------|\n`;
  for (const s of scripts) {
    const url = `${REPO_URL}/${s.relPath}`;
    table += `| [${s.name}](${url}) | ${s.description} | ${s.author} | ${s.version} | - |\n`;
  }
  return table;
}

function writeWikiPages(scriptsByCategory) {
  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR);

  // Remove wiki pages for categories that no longer exist,
  // but never delete protected files like Home.md
  const validFiles = new Set(Object.keys(scriptsByCategory).map(cat => getCategoryFileName(cat)));
  for (const file of fs.readdirSync(WIKI_DIR)) {
    if (file.endsWith('.md') && !validFiles.has(file) && !PROTECTED_FILES.has(file)) {
      fs.unlinkSync(path.join(WIKI_DIR, file));
    }
  }

  // Write or update wiki pages for each category
  for (const [cat, scripts] of Object.entries(scriptsByCategory)) {
    const fileName = getCategoryFileName(cat);
    const filePath = path.join(WIKI_DIR, fileName);
    let content = '';
    if (scripts.length > 0) {
      content = generateTable(scripts);
    } else {
      const header = `# ${fileName.replace('.md', '')}\n\n`;
      const desc = getCategoryDescription(cat) + '\n\n---\n\n### Available Scripts\n\n';
      const table = '| Script Name | Description | Author | Latest Version |\n|-------------|-------------|--------|----------------|\n';
      content = header + desc + table;
    }
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function main() {
  const scriptsByCategory = scanScriptsForCategories(SCRIPTS_DIR);
  writeWikiPages(scriptsByCategory);
  console.log('Wiki pages generated.');
}

if (require.main === module) main();
