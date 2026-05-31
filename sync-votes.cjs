const fs = require('fs');
const path = require('path');

const REPO = 'rowkav09/CCO-scripts-archive';
const WIKI_DIR = path.join(__dirname, 'wiki');
const TOKEN = process.env.GITHUB_TOKEN;
const CATEGORY_ORDER = ['auto-farm', 'bots', 'enhancements', 'gaming', 'ui', 'utilities'];

function githubHeaders(useAuth = true) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CCO-scripts-archive-sync-votes'
  };
  if (useAuth && TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  return headers;
}

async function requestJson(url, { auth = true } = {}) {
  const res = await fetch(url, { headers: githubHeaders(auth) });
  const data = await res.json();

  if (res.status === 401 && auth && TOKEN) {
    return requestJson(url, { auth: false });
  }

  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${data.message || 'unknown error'}`);
  }

  return data;
}

async function fetchVoteIssues() {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const data = await requestJson(
      `https://api.github.com/repos/${REPO}/issues?labels=vote&state=open&per_page=100&page=${page}`
    );
    if (!Array.isArray(data)) {
      throw new Error(`Unexpected vote issues payload: ${JSON.stringify(data).slice(0, 200)}`);
    }
    all.push(...data);
    if (data.length < 100) break;
  }
  return all;
}

async function fetchRatingsFromComments(issueNumber) {
  const allComments = [];
  for (let page = 1; page <= 20; page++) {
    const comments = await requestJson(`https://api.github.com/repos/${REPO}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(comments)) {
      throw new Error(`Unexpected comments payload for issue ${issueNumber}: ${JSON.stringify(comments).slice(0, 200)}`);
    }
    allComments.push(...comments);
    if (comments.length < 100) break;
  }

  // Keep latest numeric rating (0-10) per user
  const latestByUser = new Map();
  for (const c of allComments) {
    const m = c.body && c.body.match(/^\s*(10|[0-9])\s*$/m);
    if (m) latestByUser.set(c.user.login, parseInt(m[1], 10));
  }

  const values = Array.from(latestByUser.values());
  const count = values.length;
  const avg = count ? values.reduce((a, b) => a + b, 0) / count : 0;
  return { avg, count };
}

async function main() {
  const issues = await fetchVoteIssues();

  // Build maps of script name -> vote counts and vote issue URLs.
  const votes = {};
  const issueUrls = {};
  for (const issue of issues) {
    const match = issue.title.match(/^\[Vote\]\s+(.+)/);
    if (!match) continue;
    const scriptName = match[1].trim();
    const { avg, count } = await fetchRatingsFromComments(issue.number);
    votes[scriptName] = { avg, count, url: issue.html_url };
    issueUrls[scriptName] = issue.html_url;
  }

  // Inject vote counts into each wiki page
  for (const file of fs.readdirSync(WIKI_DIR)) {
    if (!file.endsWith('.md') || file === 'Home.md') continue;
    const filePath = path.join(WIKI_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = content;

    for (const [scriptName, { avg, count, url }] of Object.entries(votes)) {
      // Match table rows that link to the script URL and inject rating column
      const rowRegex = new RegExp(
        `(\\|\\s*\\[[^\\]]+\\]\\(https:\\/\\\/github\\.com\\/rowkav09\\/CCO-scripts-archive\\/blob\\/main\\/scripts\\/[^)\\n]*${escapeRegex(scriptName)}[^)\\n]*\\)\\s*\\|[^\\n]*)`,
        'g'
      );

      updated = updated.replace(rowRegex, (row) => {
        const cells = row.split('|');
        if (cells.length < 7) return row;
        const display = (count > 0) ? `${avg.toFixed(1)} / 10 (${count})` : '—';
        cells[cells.length - 2] = ` [${display}](${url}) `;
        return cells.join('|');
      });
    }

    if (updated !== content) {
      fs.writeFileSync(filePath, updated);
      console.log(`Updated votes in ${file}`);
    }
  }

  // Create a full repository-wide ranking page.
  const allScripts = listAllScripts();
  const ranked = allScripts.map(({ scriptName, category, url }) => {
    const vote = votes[scriptName] || { avg: 0, count: 0 };
    return {
      scriptName,
      category,
      url,
      issueUrl: issueUrls[scriptName],
      avg: vote.avg,
      count: vote.count
    };
  }).sort((a, b) => {
    const aRated = a.count > 0;
    const bRated = b.count > 0;
    if (aRated !== bRated) return aRated ? -1 : 1;
    if (aRated && bRated) {
      return b.avg - a.avg || b.count - a.count || a.scriptName.localeCompare(b.scriptName);
    }
    const aCategoryIndex = CATEGORY_ORDER.indexOf(a.category);
    const bCategoryIndex = CATEGORY_ORDER.indexOf(b.category);
    if (aCategoryIndex !== bCategoryIndex) return aCategoryIndex - bCategoryIndex;
    return a.scriptName.localeCompare(b.scriptName);
  });

  const rows = ['| Rank | Script | Issue | Category | Rating | Votes |', '|------|--------|-------|----------|--------:|------:|'];
  ranked.forEach((entry, index) => {
    const ratingText = entry.count > 0 ? `${entry.avg.toFixed(1)} / 10` : '—';
    const votesText = entry.count > 0 ? String(entry.count) : '0';
    const issueText = entry.issueUrl ? `[Vote Issue](${entry.issueUrl})` : '—';
    rows.push(`| ${index + 1} | [${entry.scriptName}](${entry.url}) | ${issueText} | ${entry.category} | ${ratingText} | ${votesText} |`);
  });

  const leaderboardContent = `# Leaderboard\n\nAll scripts in the repository ranked by user votes. Scripts without votes are listed at the bottom until they receive ratings.\n\n${rows.join('\n')}\n\n*Generated from script vote issues*`;
  fs.writeFileSync(path.join(WIKI_DIR, 'Leaderboard.md'), leaderboardContent);
  console.log('Updated Leaderboard.md');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findScriptUrl(scriptName) {
  const scriptsRoot = path.join(__dirname, 'scripts');
  if (!fs.existsSync(scriptsRoot)) return null;
  const folders = fs.readdirSync(scriptsRoot);
  for (const f of folders) {
    const candidate = path.join(scriptsRoot, f, scriptName);
    if (fs.existsSync(candidate)) {
      const rel = path.join('scripts', f, scriptName).replace(/\\/g, '/');
      return `https://github.com/rowkav09/CCO-scripts-archive/blob/main/${rel}`;
    }
  }
  return null;
}

function listAllScripts() {
  const scriptsRoot = path.join(__dirname, 'scripts');
  if (!fs.existsSync(scriptsRoot)) return [];

  const folders = fs.readdirSync(scriptsRoot)
    .filter(entry => fs.statSync(path.join(scriptsRoot, entry)).isDirectory())
    .sort((left, right) => left.localeCompare(right));

  const entries = [];
  for (const folder of folders) {
    const categoryDir = path.join(scriptsRoot, folder);
    const files = fs.readdirSync(categoryDir)
      .filter(file => file.endsWith('.js') && !file.startsWith('.'))
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      const scriptName = file;
      const url = `https://github.com/rowkav09/CCO-scripts-archive/blob/main/${path.join('scripts', folder, file).replace(/\\/g, '/')}`;
      entries.push({ scriptName, category: folder, url });
    }
  }

  return entries;
}

main().catch(console.error);