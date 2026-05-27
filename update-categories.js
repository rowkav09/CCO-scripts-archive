const fs = require('fs');
const path = require('path');
const { parseUserScriptHeader } = require('./parse-header');

const categories = {
  'auto-farm': 'Auto-Farming',
  'QoL': 'Quality-of-Life',
  'pricing': 'Pricing',
  'utilities': 'Utilities',
  'misc': 'Misc'
};

const scriptsDir = 'scripts';
const homePath = path.join('wiki', 'Home.md');

function getScriptsTable(folder, title) {
  const dirPath = path.join(scriptsDir, folder);
  if (!fs.existsSync(dirPath)) return '';
  // Include all .js files except index.js and files starting with '.'
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.js') && f !== 'index.js' && !f.startsWith('.'))
    .sort();
  if (files.length === 0) return '';
  let table = `\n#### ${title}\n\n| Script Name | Description | Author | Version |\n|------------|-------------|--------|---------|\n`;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const info = parseUserScriptHeader(filePath);
    // Use filename without extension for Script Name
    const scriptName = file.replace(/\.user\.js$/i, '').replace(/\.js$/i, '');
    table += `| ${scriptName} | ${info.description} | ${info.author} | ${info.version} |\n`;
  }
  return table;
}

function updateCategoriesSection(homeContent) {
  const start = homeContent.indexOf('### Script Categories');
  if (start === -1) return homeContent;
  const before = homeContent.slice(0, start);
  const afterStart = homeContent.indexOf('---', start);
  if (afterStart === -1) return homeContent;
  const after = homeContent.slice(homeContent.indexOf('\n', afterStart) + 1);

  let newSection = '### Script Categories\n';
  for (const [folder, title] of Object.entries(categories)) {
    const table = getScriptsTable(folder, title);
    if (table) newSection += table + '\n';
  }
  newSection += '---\n';
  return before + newSection + after;
}

function main() {
  if (!fs.existsSync(homePath)) {
    console.error('Home.md not found');
    process.exit(1);
  }
  const homeContent = fs.readFileSync(homePath, 'utf8');
  const updated = updateCategoriesSection(homeContent);
  if (updated !== homeContent) {
    fs.writeFileSync(homePath, updated);
    console.log('Script Categories section updated.');
  } else {
    console.log('No changes made.');
  }
}

main();
