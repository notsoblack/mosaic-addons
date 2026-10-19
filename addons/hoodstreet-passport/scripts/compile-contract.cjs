#!/usr/bin/env node
/**
 * Compile HoodStreetMemberPassport.sol using solc, emit a
 * HoodStreetMemberPassport.bytecode.json file that the addon reads
 * at deploy time. Run from the addon root:
 *
 *   npm run build:contract
 *
 * Output: src/contracts/HoodStreetMemberPassport.bytecode.json
 *
 * Requires:
 *   - solc (npm install -D solc@0.8.28)
 *   - @openzeppelin/contracts (npm install @openzeppelin/contracts@5.0.2)
 */
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const ROOT = path.join(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'src', 'contracts', 'HoodStreetMemberPassport.sol');
const OUT_PATH = path.join(ROOT, 'src', 'contracts', 'HoodStreetMemberPassport.bytecode.json');

function findImports(importPath) {
  // Resolve @openzeppelin/contracts/... relative to the project root's
  // node_modules. solc calls this synchronously for each import.
  if (importPath.startsWith('@openzeppelin/contracts/')) {
    const local = path.join(ROOT, 'node_modules', importPath);
    if (fs.existsSync(local)) {
      return { contents: fs.readFileSync(local, 'utf8') };
    }
  }
  return { error: 'File not found: ' + importPath };
}

function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`Source not found: ${SOURCE_PATH}`);
    process.exit(1);
  }
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  console.log(`Compiling ${SOURCE_PATH}...`);

  const input = {
    language: 'Solidity',
    sources: {
      'HoodStreetMemberPassport.sol': { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errs = output.errors || [];
  const fatal = errs.filter((e) => e.severity === 'error');
  for (const e of errs) {
    console.log(`[${e.severity}] ${e.formattedMessage}`);
  }
  if (fatal.length > 0) {
    console.error(`\nCompilation failed: ${fatal.length} fatal error(s)`);
    process.exit(1);
  }

  // solc's output is nested as:
  //   output.contracts[sourceFile][contractName] = { abi, evm, ... }
  // We pick the first contract in our source file that has a non-empty
  // bytecode (interfaces return empty bytecode).
  const candidates = Object.keys(output.contracts || {});
  const sourceKey = candidates.find((k) => k.endsWith('HoodStreetMemberPassport.sol'));
  const fileContracts = sourceKey ? output.contracts[sourceKey] : undefined;
  if (!fileContracts) {
    console.error('No compiled contracts in expected source file. Available keys:', candidates);
    process.exit(1);
  }
  const compiled = Object.values(fileContracts).find(
    (c) => c.evm?.bytecode?.object && c.evm.bytecode.object.length > 0,
  );
  if (!compiled) {
    console.error('No contract with bytecode in source file. Contracts:', Object.keys(fileContracts));
    process.exit(1);
  }

  const artifact = {
    abi: compiled.abi,
    bytecode: '0x' + compiled.evm.bytecode.object,
    deployedBytecode: '0x' + (compiled.evm.deployedBytecode?.object || compiled.evm.bytecode.object),
    compiler: { version: solc.version() },
    compiledAt: new Date().toISOString(),
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 2));
  const byteLen = (artifact.bytecode.length - 2) / 2;
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  bytecode:  ${byteLen} bytes`);
  console.log(`  functions: ${artifact.abi.filter((x) => x.type === 'function').length}`);
  console.log(`  events:    ${artifact.abi.filter((x) => x.type === 'event').length}`);
  console.log(`  errors:    ${artifact.abi.filter((x) => x.type === 'error').length}`);
  console.log(`  compiler:  ${artifact.compiler.version}`);
}

main();
