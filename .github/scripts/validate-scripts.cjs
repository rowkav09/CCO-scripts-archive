#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Fields every submitted script must have
const REQUIRED_FIELDS = ['name', 'version', 'author', 'description', 'match'];

// Fields that are strongly encouraged but won't fail the check
const RECOMMENDED_FIELDS = ['namespace', 'grant'];

// @match must point at CCO
const CCO_PATTERN = /case-clicker\.com/;

// ─── Header parser ────────────────────────────────────────────────────────────

function parseHeader(content) {
  const block = content.match(/==UserScript==([\s\S]*?)==\/UserScript==/);
  if (!block) return null;

  const fields = {};
  for (const line of block[1].split('\n')) {
    const m = line.match(/\/\/\s*@(\w[\w-]*)\s+(.*)/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (!fields[key]) fields[key] = [];
    fields[key].push(m[2].trim());
  }
  return fields;
}

// ─── Per-file validation ───────────────────────────────────────────────────────

function validateFile(filePath) {
  const errors = [];
  const warnings = [];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    errors.push('Could not read file');
    return { errors, warnings };
  }

  if (!filePath.endsWith('.user.js')) {
    errors.push('File must use the `.user.js` extension for Tampermonkey one-click install');
  }

  const header = parseHeader(content);
  if (!header) {
    errors.push('Missing `==UserScript==` / `==/UserScript==` header block');
    return { errors, warnings };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!header[field]?.length) {
      errors.push(`Missing required field: \`@${field}\``);
    }
  }

  if (header.match?.length) {
    const pointsAtCCO = header.match.some(m => CCO_PATTERN.test(m));
    if (!pointsAtCCO) {
      errors.push(
        '`@match` does not reference `case-clicker.com` — script will not activate on CCO'
      );
    }
  }

  for (const field of RECOMMENDED_FIELDS) {
    if (!header[field]?.length) {
      warnings.push(`Missing recommended field: \`@${field}\``);
    }
  }

  return { errors, warnings };
}

// ─── ESLint ───────────────────────────────────────────────────────────────────

function runEslint(files) {
  const results = {};
  for (const file of files) {
    try {
      execSync(`npx eslint --no-eslintrc -c .eslintrc.json "${file}" --format json`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      results[file] = [];
    } catch (err) {
      try {
        const parsed = JSON.parse(err.stdout || '[]');
        const fileResult = parsed.find(r => r.filePath.endsWith(path.basename(file)));
        results[file] = fileResult
          ? fileResult.messages.map(m => `Line ${m.line}: [${m.severity === 2 ? 'error' : 'warn'}] ${m.message} (${m.ruleId || 'syntax'})`)
          : [];
      } catch {
        results[file] = ['Could not parse ESLint output'];
      }
    }
  }
  return results;
}

// ─── Markdown report builder ──────────────────────────────────────────────────

function buildReport(files, headerResults, eslintResults) {
  const totalErrors = Object.values(headerResults).reduce((n, r) => n + r.errors.length, 0)
    + Object.values(eslintResults).reduce((n, msgs) => n + msgs.filter(m => m.includes('[error]')).length, 0);

  const lines = [];

  const statusIcon = totalErrors > 0 ? '❌' : '✅';
  const statusText = totalErrors > 0
    ? `**${totalErrors} error${totalErrors !== 1 ? 's' : ''} found** — please fix before merging`
    : '**All checks passed**';

  lines.push(`## ${statusIcon} Script Validation — ${statusText}`);
  lines.push('');

  for (const file of files) {
    const name = path.basename(file);
    const hr = headerResults[file] || { errors: [], warnings: [] };
    const eslint = eslintResults[file] || [];
    const eslintErrors = eslint.filter(m => m.includes('[error]'));
    const eslintWarnings = eslint.filter(m => !m.includes('[error]'));

    const fileErrors = hr.errors.length + eslintErrors.length;
    const fileWarnings = hr.warnings.length + eslintWarnings.length;
    const fileIcon = fileErrors > 0 ? '❌' : fileWarnings > 0 ? '⚠️' : '✅';

    lines.push(`### ${fileIcon} \`${name}\``);
    lines.push('');

    if (fileErrors === 0 && fileWarnings === 0) {
      lines.push('All checks passed.');
    } else {
      if (hr.errors.length) {
        lines.push('**Header errors**');
        for (const e of hr.errors) lines.push(`- 🔴 ${e}`);
        lines.push('');
      }
      if (hr.warnings.length) {
        lines.push('**Header warnings**');
        for (const w of hr.warnings) lines.push(`- 🟡 ${w}`);
        lines.push('');
      }
      if (eslintErrors.length) {
        lines.push('**ESLint errors**');
        for (const e of eslintErrors) lines.push(`- 🔴 ${e}`);
        lines.push('');
      }
      if (eslintWarnings.length) {
        lines.push('**ESLint warnings**');
        for (const w of eslintWarnings) lines.push(`- 🟡 ${w}`);
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push('*Automated check by [CCO Scripts Archive](https://github.com/rowkav09/CCO-scripts-archive)*');

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const raw = (process.env.CHANGED_FILES || '').trim();
  const files = raw ? raw.split('\n').map(f => f.trim()).filter(Boolean) : [];

  if (files.length === 0) {
    process.stdout.write('## ✅ Script Validation\n\nNo `.user.js` script files changed in this PR.\n');
    process.exit(0);
  }

  const headerResults = {};
  for (const file of files) {
    headerResults[file] = validateFile(file);
  }

  const eslintResults = runEslint(files);

  const report = buildReport(files, headerResults, eslintResults);
  process.stdout.write(report);

  const hasErrors = Object.values(headerResults).some(r => r.errors.length > 0)
    || Object.values(eslintResults).some(msgs => msgs.some(m => m.includes('[error]')));

  process.exit(hasErrors ? 1 : 0);
}

main();
