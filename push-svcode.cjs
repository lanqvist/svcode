const { execSync } = require('child_process');
const fs = require('fs');
require('dotenv').config();

const repoName = 'svcode';
const username = 'lanqvist';
const token = process.env.GITHUB_TOKEN;

const gitUrl = `https://${username}:${token}@github.com/${username}/${repoName}.git`;
const tempDir = 'temp-svcode';

try {
  fs.rmSync(tempDir, { recursive: true, force: true });
} catch {}

fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(`${tempDir}/projects`, { recursive: true });
execSync(`git init`, { cwd: tempDir });
execSync(`git remote add origin ${gitUrl}`, { cwd: tempDir });

const srcDir = '.';
const entries = fs.readdirSync(srcDir);

for (const entry of entries) {
  if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === 'temp-clones' || entry === 'projects' || entry === 'temp-svcode') continue;
  try {
    fs.cpSync(entry, `${tempDir}/${entry}`, { recursive: true, force: true });
  } catch {}
}

fs.writeFileSync(`${tempDir}/projects/.gitkeep`, '');

execSync(`git add .`, { cwd: tempDir });
execSync(`git commit -m "Initial commit - Vibe Coding Tool"`, { cwd: tempDir });
execSync(`git branch -M main`, { cwd: tempDir });
execSync(`git push -u origin main --force`, { cwd: tempDir });

console.log('Code pushed to https://github.com/lanqvist/svcode');