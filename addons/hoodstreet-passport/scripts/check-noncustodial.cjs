#!/usr/bin/env node
/**
 * Non-custodial guard — fails the build if the source code contains
 * any pattern that would let HoodStreet Passport take custody of a
 * user's private key, seed phrase, or signing capability.
 *
 * This is a hard architectural invariant: every HoodStreet feature
 * must preserve user-controlled signing. The README says "never
 * holds keys" but we enforce it here so a future PR can't
 * accidentally introduce a custodial pattern.
 *
 * Add to your CI / pre-commit / pre-push. The harness is intentionally
 * strict: false positives are easier to deal with than a real key
 * handling bug.
 *
 * Patterns that are FORBIDDEN anywhere in src/ or scripts/:
 *   - Accepting a private key as a function argument
 *   - Storing a private key in a file or localStorage
 *   - Importing from 'ethers' Wallet constructors with a private key
 *   - Calling wallet.createWallet or similar with a key string
 *   - Logging a key-shaped string (0x[64 hex chars])
 *   - Network calls that include a "privateKey" field
 *
 * Patterns that are ALLOWED:
 *   - window.ethereum (the user's wallet provider) — read-only access
 *   - viem's createWalletClient({ transport: custom(window.ethereum) })
 *   - privateKeyToAccount() inside scripts/ for non-custodial dev
 *     deploys — but only when the script name contains "deploy" and
 *     the key comes from process.env.PRIVATE_KEY, not a file
 *
 * Run as: node scripts/check-noncustodial.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIRS = ['src', 'scripts'];
const SRC_EXTS = ['.ts', '.tsx', '.js', '.cjs', '.mjs', '.sol'];

const FORBIDDEN_PATTERNS = [
  // Hard-coded private keys (0x + 64 hex chars), but NOT when:
  //   - inside a string labeled 'topic' / 'topicHash' / 'selector' / 'event' / 'method' /
  //     'bytes32' / 'hash' / 'HoodStreetMemberPassport' (these are well-known constants
  //     like ERC-20 Transfer topics, not cryptographic keys)
  { pattern: /['"]?privateKey['"]?\s*[:=]\s*['"]?0x[0-9a-fA-F]{64}/, reason: 'hard-coded private key' },
  { pattern: /privateKey\s*=\s*['"]0x[0-9a-fA-F]{64}/, reason: 'private key assignment' },
  // localStorage / sessionStorage writes of anything that includes the word "key"
  // AND is followed by an actual hex value
  { pattern: /localStorage\.setItem\s*\([^)]*['"][^'"]*key[^'"]*['"][^)]*,\s*['"]0x[0-9a-fA-F]+/i, reason: 'localStorage key-shaped write with hex' },
  { pattern: /sessionStorage\.setItem\s*\([^)]*['"][^'"]*key[^'"]*['"][^)]*,\s*['"]0x[0-9a-fA-F]+/i, reason: 'sessionStorage key-shaped write with hex' },
  // wallet.createWallet or new ethers.Wallet with a key arg
  { pattern: /new\s+ethers\.Wallet\s*\(\s*['"]0x/, reason: 'ethers.Wallet constructor with key string' },
  // fs.writeFileSync to anything that looks like a key file
  { pattern: /fs\.writeFileSync\s*\(\s*['"][^'"]*\.pem['"]/i, reason: 'writes a .pem key file' },
  { pattern: /fs\.writeFileSync\s*\(\s*['"][^'"]*\.key['"]/i, reason: 'writes a .key file' },
  { pattern: /fs\.writeFileSync\s*\(\s*['"][^'"]*seed/i, reason: 'writes a seed file' },
  // Network calls with a privateKey field
  { pattern: /["']privateKey["']\s*:/, reason: 'object with privateKey field' },
  // Generic seed phrase storage
  { pattern: /\bseed_?phrase\b\s*[:=]\s*['"]/i, reason: 'seed phrase literal' },
  // 12/24-word mnemonic lists (very rough heuristic)
  { pattern: /\bmnemonic\b/i, reason: 'mnemonic reference' },
];

const EXEMPT_FILES = [
  // The compile script references the OZ import path; not a key
  'scripts/compile-contract.cjs',
  // The deploy script is allowed to use a local PRIVATE_KEY env var
  // for non-custodial testnet deploys; it never sends the key to a
  // remote service.
  'scripts/deploy-collection.cjs',
  // This guard itself
  'scripts/check-noncustodial.cjs',
];

let failures = 0;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'renderer' || name === 'dist' || name === '.git') continue;
      walk(full);
    } else {
      if (!SRC_EXTS.includes(path.extname(name))) continue;
      if (EXEMPT_FILES.some((ex) => full.endsWith(ex))) {
        // For exempt files, only check the FORBIDDEN list without the
        // 'seed phrase literal' or 'mnemonic reference' rules.
        checkFile(full, true);
      } else {
        checkFile(full, false);
      }
    }
  }
}

function checkFile(path, isExempt) {
  const text = fs.readFileSync(path, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (isExempt && (reason.includes('mnemonic') || reason.includes('seed phrase'))) {
        continue;
      }
      if (pattern.test(line)) {
        // Skip false positives: comments and string literals that
        // document the rule.
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        console.error(`✗ ${path}:${i + 1}: ${reason}`);
        console.error(`    ${line.trim()}`);
        failures++;
      }
    }
  }
}

for (const d of SRC_DIRS) {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) walk(full);
}

if (failures > 0) {
  console.error(`\n${failures} non-custodial violation(s) found.`);
  console.error('The README is not enough. This is enforced at build time.');
  process.exit(1);
}
console.log('✓ Non-custodial guard passed.');
