#!/usr/bin/env node
// Generates identity source maps for all JS files in the project.
// Vanilla JS has no minification, so each line maps to itself.
// This allows PostHog's Cymbal service to resolve stack frames
// without hitting the NoSourcemap error path.
const fs = require('fs');
const path = require('path');

function generateIdentitySourceMap(filePath, content) {
  const lines = content.split('\n');
  const fileName = path.basename(filePath);
  // VLQ encoding for identity mapping: each line maps to same line/col in source
  // For identity maps, each segment is "AAAA" (0,0,0,0 deltas) for first segment,
  // then "AACA" for subsequent lines (0,0,+1,0)
  const mappings = lines.map((_, i) => i === 0 ? 'AAAA' : 'AACA').join(';');

  return JSON.stringify({
    version: 3,
    file: fileName,
    sources: [fileName],
    sourcesContent: [content],
    names: [],
    mappings
  });
}

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.name.endsWith('.js') && entry.name !== 'posthog-config.js') {
      const content = fs.readFileSync(fullPath, 'utf8');
      const mapContent = generateIdentitySourceMap(fullPath, content);
      const mapPath = fullPath + '.map';
      fs.writeFileSync(mapPath, mapContent);
      // Append sourceMappingURL to JS file if not already present
      if (!content.includes('sourceMappingURL')) {
        fs.appendFileSync(fullPath, `\n//# sourceMappingURL=${entry.name}.map\n`);
      }
      console.log(`Generated ${path.relative(process.cwd(), mapPath)}`);
    }
  }
}

const jsDir = path.join(__dirname, '..', 'js');
processDir(jsDir);
console.log('Done generating source maps.');
