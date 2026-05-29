const fs = require('fs');
const path = require('path');

const REPO = 'rowkav09/CCO-scripts-archive';
const WIKI_DIR = path.join(__dirname, 'wiki');
const TOKEN = process.env.GITHUB_TOKEN;

async function fetchVoteIssues() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/issues?labels=vote&state=open&per_page=100`,
    { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  return res.json();
}

async function fetchRatingsFromComments(issueNumber) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/issues/${issueNumber}/comments`,
    { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  const comments = await res.json();

  // Keep latest numeric rating (0-10) per user
  const latestByUser = new Map();
  for (const c of comments) {
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

  // Build a map of script name -> vote counts
  const votes = {};
  for (const issue of issues) {
    const match = issue.title.match(/^\[Vote\]\s+(.+)/);
    if (!match) continue;
    const scriptName = match[1].trim();
    const { avg, count } = await fetchRatingsFromComments(issue.number);
    votes[scriptName] = { avg, count, url: issue.html_url };
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
        // Remove old thumbs or rating cell if present
        let stripped = row.replace(/\s*\|\s*\[👍[^|]*\]\([^)]*\)\s*\|?$/, '');
        stripped = stripped.replace(/\s*\|\s*\[?\d+(?:\.\d+)?\s*\/\s*10[^|]*\]\([^)]*\)\s*\|?$/, '');

        const display = (count > 0) ? `${avg.toFixed(1)} / 10 (${count})` : '—';
        return `${stripped} | [${display}](${url}) |`;
      });
    }

    if (updated !== content) {
      fs.writeFileSync(filePath, updated);
      console.log(`Updated votes in ${file}`);
    }
  }

    // Create Top-Scripts leaderboard
    const leaderboard = [];
    for (const [scriptName, { avg, count }] of Object.entries(votes)) {
      if (count > 0) leaderboard.push({ scriptName, avg, count });
    }
    leaderboard.sort((a, b) => b.avg - a.avg || b.count - a.count);

    if (leaderboard.length) {
      const rows = ['| Rank | Script | Rating | Votes |', '|------|--------|--------:|------:|'];
      for (let i = 0; i < Math.min(20, leaderboard.length); i++) {
        const e = leaderboard[i];
        const url = findScriptUrl(e.scriptName) || '#';
        rows.push(`| ${i+1} | [${e.scriptName}](${url}) | ${e.avg.toFixed(1)} / 10 | ${e.count} |`);
      }
      const content = `# Top Scripts\n\n${rows.join('\n')}\n\n*Generated from script vote issues*`;
      fs.writeFileSync(path.join(WIKI_DIR, 'Top-Scripts.md'), content);
      console.log('Updated Top-Scripts.md');
    }
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

main().catch(console.error);