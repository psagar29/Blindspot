#!/usr/bin/env node
/** Dependency-free planning-kit sanity check. Not an application/physics test. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'README.md', 'AGENTS.md', 'CLAUDE.md', 'PRODUCT.md', 'DESIGN.md', '.env.example', '.gitignore',
  'shared/contracts.ts', 'docs/BUILD-PLAN.md', 'docs/ARCHITECTURE.md', 'docs/CONTRACTS.md',
  'docs/SETUP.md', 'docs/EVENT-SPONSORS.md', 'docs/TECHNICAL-NOTES.md', 'docs/ACCEPTANCE.md', 'docs/DEMO.md',
  ...['A','B','C'].flatMap(role => [`docs/roles/PERSON-${role}.md`, `docs/handoffs/PERSON-${role}.md`]),
];
const errors = [];
for (const name of required) if (!fs.existsSync(path.join(root, name))) errors.push(`Missing ${name}`);
for (const name of required.filter(x => x.endsWith('.md'))) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, 'utf8');
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(full), decodeURIComponent(target)))) {
      errors.push(`Broken relative link in ${name}: ${target}`);
    }
  }
}
const contractsPath = path.join(root, 'shared/contracts.ts');
if (fs.existsSync(contractsPath)) {
  const contracts = fs.readFileSync(contractsPath, 'utf8');
  for (const token of ['CONTRACT_VERSION', 'CLAIM_BOUNDARY', 'AppState', 'AppActions', 'RuntimeBridge', 'ReportSnapshot', 'confirmCalibration']) {
    if (!contracts.includes(token)) errors.push(`Missing boundary symbol: ${token}`);
  }
}
const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const line of example.split('\n')) {
  if (/^(CONVEX_DEPLOY_KEY|WORLD_LABS_API_KEY|TRIPO_API_KEY|MODEL_API_KEY)=.+/.test(line)) errors.push('Nonblank credential in .env.example');
}
const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
if (!ignore.includes('.env.*') || !ignore.includes('!.env.example')) errors.push('Missing env ignore/blank-template rules');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Release structure OK: ${required.length} required files, relative links, contract symbols, blank credentials template.`);
  console.log('This checks documentation structure only; run the type, test, build, and live acceptance commands separately.');
}
