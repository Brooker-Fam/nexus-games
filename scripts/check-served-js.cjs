#!/usr/bin/env node
// Pre-deploy guard for the static frontend.
//
// A single un-parseable file served raw by index.html (~30 <script> tags, no
// bundler) takes down the whole homepage with a parse-time SyntaxError. The
// classic culprit is a Git merge-conflict marker accidentally committed into a
// served file — the parser chokes on `<<<<<<<` and reports `Unexpected token '<<'`.
//
// This script runs as part of the build (see package.json / vercel.json) so a
// malformed file can never ship:
//   1. Greps every source file for conflict markers.
//   2. Runs `node --check` on every served JS file.
// It exits non-zero (failing the build) if anything is wrong.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// Recursively collect files under `dir` whose name matches `exts`, skipping
// directories we never serve.
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel']);
function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), exts, out);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const rel = (f) => path.relative(root, f);

// 1. Conflict-marker scan over every text source we ship.
// `<<<<<<<` and `>>>>>>>` are unambiguous; a bare `=======` separator is exactly
// seven equals on its own line, so anchoring avoids decorative `// ====` dividers.
const CONFLICT_RE = /^(<<<<<<< |>>>>>>> |=======$|<<<<<<<$|>>>>>>>$)/;
const textFiles = walk(root, ['.js', '.cjs', '.mjs', '.html', '.css', '.json']);
const conflicts = [];
for (const file of textFiles) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (CONFLICT_RE.test(line)) {
      conflicts.push(`${rel(file)}:${i + 1}: ${line.slice(0, 40)}`);
    }
  });
}

// 2. Parse-check every served JS file.
const jsFiles = walk(path.join(root, 'js'), ['.js']);
const parseErrors = [];
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').toString().trim();
    parseErrors.push(`${rel(file)}:\n${detail}`);
  }
}

if (conflicts.length === 0 && parseErrors.length === 0) {
  console.log(`check-served-js: OK (${jsFiles.length} JS files parsed, ${textFiles.length} files scanned for conflict markers)`);
  process.exit(0);
}

if (conflicts.length > 0) {
  console.error(`\ncheck-served-js: found ${conflicts.length} Git conflict marker(s):`);
  conflicts.forEach((c) => console.error(`  ${c}`));
}
if (parseErrors.length > 0) {
  console.error(`\ncheck-served-js: ${parseErrors.length} file(s) failed to parse:`);
  parseErrors.forEach((e) => console.error(`  ${e}`));
}
console.error('\nA malformed served file would break the homepage with a parse-time SyntaxError. Fix the above before deploying.');
process.exit(1);
