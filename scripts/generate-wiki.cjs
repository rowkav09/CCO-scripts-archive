const fs = require('fs');
const path = require('path');

// Category mapping for output filenames
const CATEGORY_MAP = {
  'auto-farm': 'Auto-Farming.md',
  'qol': 'QOL.md',
  'utilities': 'Utilities.md',
  'enhancements': 'Enhancements.md',
  'misc': 'Misc.md',
  'pricing': 'Pricing.md',
};

const SCRIPTS_DIR = __dirname;
const WIKI_DIR = path.join(__dirname, '..', 'wiki');
const REPO_URL = 'https://github.com/rowkav09/CCO-scripts-archive/blob/main/scripts';


function getCategoryFileName(category) {
  // Always capitalize first letter, rest lowercase, and use mapping if available
  const normalized = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  return CATEGORY_MAP[category.toLowerCase()] || `${normalized}.md`;
}

function cleanWikiDuplicates() {
  const files = fs.readdirSync(WIKI_DIR);
  const seen = new Set();
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const base = file.toLowerCase();
    if (seen.has(base)) {
      fs.unlinkSync(path.join(WIKI_DIR, file));
    } else {
      seen.add(base);
    }
  }
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

function scanScripts(dir, category, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanScripts(fullPath, entry.name, results);
    } else if (entry.isFile()) {
      const meta = extractMetadata(fullPath);
      results.push({
        name: entry.name,
        category,
        path: fullPath,
        relPath: path.relative(SCRIPTS_DIR, fullPath).replace(/\\/g, '/'),
        ...meta,
      });
    }
  }
}

function groupByCategory(scripts) {
  const grouped = {};
  for (const script of scripts) {
    const cat = script.category.toLowerCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(script);
  }
  return grouped;
}

function generateTable(scripts) {
  let table = `| Script Name | Description | Author | Latest Version |\n|-------------|-------------|--------|----------------|\n`;
  for (const s of scripts) {
    const url = `${REPO_URL}/${s.relPath}`;
    table += `| [${s.name}](${url}) | ${s.description} | ${s.author} | ${s.version} |\n`;
  }
  return table;
}

function writeWikiPages(grouped) {
  if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR);
  for (const [cat, scripts] of Object.entries(grouped)) {
    const fileName = getCategoryFileName(cat);
    const filePath = path.join(WIKI_DIR, fileName);
    const table = generateTable(scripts);
    fs.writeFileSync(filePath, table, 'utf8');
  }
}


function main() {
  cleanWikiDuplicates();
  const scripts = [];
  scanScripts(SCRIPTS_DIR, '', scripts);
  const grouped = groupByCategory(scripts);
  writeWikiPages(grouped);
  console.log('Wiki pages generated.');
}

if (require.main === module) main();
