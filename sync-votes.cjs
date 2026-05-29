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

async function fetchReactions(issueNumber) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/issues/${issueNumber}/reactions`,
    { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  const reactions = await res.json();
  const up = reactions.filter(r => r.content === '+1').length;
  const down = reactions.filter(r => r.content === '-1').length;
  return { up, down };
}

async function main() {
  const issues = await fetchVoteIssues();

  // Build a map of script name -> vote counts
  const votes = {};
  for (const issue of issues) {
    const match = issue.title.match(/^\[Vote\]\s+(.+)/);
    if (!match) continue;
    const scriptName = match[1].trim();
    const { up, down } = await fetchReactions(issue.number);
    votes[scriptName] = { up, down, url: issue.html_url };
  }

  // Inject vote counts into each wiki page
  for (const file of fs.readdirSync(WIKI_DIR)) {
    if (!file.endsWith('.md') || file === 'Home.md') continue;
    const filePath = path.join(WIKI_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = content;

    for (const [scriptName, { up, down, url }] of Object.entries(votes)) {
      // Match table rows containing this script name and inject vote column
      const rowRegex = new RegExp(
        `(\\|\\s*\\[?${escapeRegex(scriptName)}\\]?[^|]*\\|[^\\n]+)`,
        'g'
      );
      updated = updated.replace(rowRegex, (row) => {
        // Remove existing vote cell if present, then add fresh one
        const stripped = row.replace(/\s*\|\s*[👍🗳️][^|]*$/, '');
        return `${stripped} | [👍 ${up} / 👎 ${down}](${url}) |`;
      });
    }

    if (updated !== content) {
      fs.writeFileSync(filePath, updated);
      console.log(`Updated votes in ${file}`);
    }
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch(console.error);