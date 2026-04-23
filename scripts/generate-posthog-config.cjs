#!/usr/bin/env node
// Generates js/posthog-config.js from environment variables.
// Run as part of the Vercel build step.
const fs = require('fs');
const path = require('path');

const token = process.env.POSTHOG_TOKEN || '';
const host = process.env.POSTHOG_HOST || '';

const output = `window.POSTHOG_TOKEN=${JSON.stringify(token)};\nwindow.POSTHOG_HOST=${JSON.stringify(host)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'posthog-config.js'), output);
console.log('Generated js/posthog-config.js');
