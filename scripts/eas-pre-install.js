const fs = require('fs');
const path = require('path');

const lockfilePath = path.join(process.cwd(), 'yarn.lock');
const internalRegistry = /http:\/\/package-firewall\.replit\.internal\/npm\//g;
const publicRegistry = 'https://registry.npmjs.org/';

if (!fs.existsSync(lockfilePath)) {
  throw new Error('yarn.lock is required for EAS builds');
}

const lockfile = fs.readFileSync(lockfilePath, 'utf8');
const updatedLockfile = lockfile.replace(internalRegistry, publicRegistry);

if (updatedLockfile.includes('package-firewall.replit.internal')) {
  throw new Error('yarn.lock still contains an internal Replit registry URL');
}

if (updatedLockfile !== lockfile) {
  fs.writeFileSync(lockfilePath, updatedLockfile);
  console.log('Replaced internal registry URLs in yarn.lock for EAS');
} else {
  console.log('yarn.lock already uses public registry URLs');
}