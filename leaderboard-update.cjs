// leaderboard-update.js
// Scans all scripts in scripts/ subfolders, counts @author tags, and updates README.md leaderboard

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const README_PATH = path.join(__dirname, 'README.md');
const LEADERBOARD_START = '<!-- LEADERBOARD_START -->';
const LEADERBOARD_END = '<!-- LEADERBOARD_END -->';

function getAllScriptFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return getAllScriptFiles(entryPath);
      return entry.name.endsWith('.user.js') && !entry.name.startsWith('.') ? [entryPath] : [];
    });
}

function extractAuthors(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const authorRegex = /@author\s+([\w\s-]+)/g;
  let match;
  const authors = [];
  while ((match = authorRegex.exec(content)) !== null) {
    authors.push(match[1].trim());
  }
  return authors;
}

function buildLeaderboard(authorsCount) {
  const sorted = Object.entries(authorsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let md = '| Rank | Author | Scripts |\n|---|---|---|\n';
  for (let i = 0; i < sorted.length; i++) {
    const [author, count] = sorted[i];
    md += `| ${i + 1} | ${author} | ${count} |\n`;
  }
  return md;
}

function updateReadme(leaderboardMd) {
  let readme = fs.readFileSync(README_PATH, 'utf8');
  const start = readme.indexOf(LEADERBOARD_START);
  const end = readme.indexOf(LEADERBOARD_END);
  if (start !== -1 && end !== -1 && end > start) {
    const before = readme.slice(0, start + LEADERBOARD_START.length);
    const after = readme.slice(end);
    readme = before + '\n' + leaderboardMd + after;
  } else {
    // If markers not found, append at end
    readme += `\n${LEADERBOARD_START}\n${leaderboardMd}${LEADERBOARD_END}\n`;
  }
  fs.writeFileSync(README_PATH, readme, 'utf8');
}

function main() {
  const files = getAllScriptFiles(SCRIPTS_DIR);
  const authorsCount = {};
  for (const file of files) {
    for (const author of extractAuthors(file)) {
      authorsCount[author] = (authorsCount[author] || 0) + 1;
    }
  }
  const leaderboardMd = buildLeaderboard(authorsCount);
  updateReadme(leaderboardMd);
  console.log('Leaderboard updated in README.md');
}

main();
