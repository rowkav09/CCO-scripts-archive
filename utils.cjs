const REPO = process.env.GITHUB_REPOSITORY || 'rowkav09/CCO-scripts-archive';
const BROKEN_ISSUE_TEMPLATE = 'script-not-working.yml';

function buildBrokenIssueUrl({ scriptName, scriptUrl, category }) {
  const title = encodeURIComponent(`[Broken] ${scriptName}`);
  const body = encodeURIComponent(
    `Submit this only if the script is not working.\n\nPlease test it properly before opening the issue.\n\nTag @rowka and I will confirm whether it works or not by reacting with works or doesnt.\n\n**Script:** [${scriptName}](${scriptUrl})\n**Category:** ${category}\n\n**What is broken?**\n`
  );
  return `https://github.com/${REPO}/issues/new?template=${BROKEN_ISSUE_TEMPLATE}&title=${title}&body=${body}`;
}

module.exports = { REPO, buildBrokenIssueUrl };
