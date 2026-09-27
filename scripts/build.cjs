#!/usr/bin/env node
/**
 * Build script - obfuscates src/ into dist/ with strong protection.
 * Pattern: matches oddsockets-nodejs-sdk (javascript-obfuscator), but keeps
 * ESM import/export and mirrors the src/ directory layout so relative
 * `./file.js` / `../file.js` imports and the package `exports` map still resolve.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Every source module to obfuscate. Same-dir relative imports are preserved
// because each file keeps its name and relative location under dist/.
const files = [
  'index.js',
  'client.js',
  'channel.js',
  'enhanced-features.js',
  'errors.js',
  'message-types.js',
  'utils.js',
  'stores/index.js',
  'components/index.js',
];

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

// Fresh dist each build so stale files never ship.
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const flags = [
  '--compact true',
  '--control-flow-flattening true',
  '--control-flow-flattening-threshold 0.75',
  '--dead-code-injection true',
  '--dead-code-injection-threshold 0.4',
  '--string-array true',
  '--string-array-encoding rc4',
  '--string-array-threshold 1',
  '--string-array-rotate true',
  '--string-array-shuffle true',
  '--string-array-wrappers-count 2',
  '--string-array-wrappers-type function',
  '--rename-globals true',
  '--rename-properties false',
  '--self-defending false',
  '--identifier-names-generator hexadecimal',
  '--numbers-to-expressions true',
  '--simplify true',
  '--split-strings true',
  '--split-strings-chunk-length 5',
  '--transform-object-keys true',
  '--unicode-escape-sequence true',
  '--target browser',
].join(' ');

const obfuscator =
  process.env.OBFUSCATOR_BIN || 'javascript-obfuscator';

console.log('Building OddSockets Svelte SDK...');
for (const file of files) {
  const src = path.join(srcDir, file);
  const out = path.join(distDir, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  console.log(`  Obfuscating ${file}...`);
  execSync(`${obfuscator} ${src} --output ${out} ${flags}`, { stdio: 'inherit' });
}

console.log('Build complete.');
