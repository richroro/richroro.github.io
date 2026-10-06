// Playwright from this project if installed, otherwise from the global npm root.
// CHROMIUM_PATH overrides the browser binary; SITE is where the repo is served.
let pw;
try { pw = require('playwright'); } catch {
  pw = require(require('path').join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
}
const launch = (opts = {}) => pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, ...opts });
const SITE = process.env.SITE || 'http://127.0.0.1:8765';
module.exports = { launch, SITE };
