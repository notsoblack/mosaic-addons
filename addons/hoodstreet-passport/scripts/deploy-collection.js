#!/usr/bin/env node
/**
 * Deploy HoodStreetMemberPassport to Robinhood Chain (or any EVM chain).
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/deploy-collection.js \
 *     --name "HoodStreet Member Passport" \
 *     --symbol HSMP \
 *     --parent 0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146 \
 *     --tba 0x... \
 *     --tokenId 7980 \
 *     --baseUri ipfs://
 *
 *   PRIVATE_KEY is a dedicated deployer wallet. Never reuse a wallet
 *   that holds mainnet funds.
 *
 * Output: a JSON file with the deployed contract address + tx hash.
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('node:util');

const { createWalletClient, createPublicClient, http, defineChain } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const ROBINHOOD_CHAIN = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

const HOODSTREET_DEPLOYMENT = {
  parentNft: '0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146',
};

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      symbol: { type: 'string' },
      parent: { type: 'string' },
      tba: { type: 'string' },
      tokenId: { type: 'string' },
      baseUri: { type: 'string', default: 'ipfs://' },
      rpc: { type: 'string', default: 'https://rpc.mainnet.chain.robinhood.com' },
    },
  });

  if (!values.name || !values.symbol || !values.parent || !values.tba || !values.tokenId) {
    console.error('Required: --name --symbol --parent --tba --tokenId');
    process.exit(1);
  }

  const pk = process.env.PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    console.error('PRIVATE_KEY env var must be set to a 0x-prefixed 64-char hex string');
    process.exit(1);
  }

  const bytecodePath = path.join(__dirname, '..', 'src', 'contracts', 'HoodStreetMemberPassport.bytecode.json');
  if (!fs.existsSync(bytecodePath)) {
    console.error(`Bytecode artifact not found: ${bytecodePath}. Run \`npm run build:contract\` first.`);
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(bytecodePath, 'utf8'));
  const abi = artifact.abi;

  const account = privateKeyToAccount(pk);
  console.log(`Deployer: ${account.address}`);

  const chain = { ...ROBINHOOD_CHAIN, rpcUrls: { default: { http: [values.rpc] } } };
  const publicClient = createPublicClient({ chain, transport: http() });
  const wallet = createWalletClient({ account, chain, transport: http() });

  console.log(`\nDeploying HoodStreetMemberPassport...`);
  console.log(`  name:        ${values.name}`);
  console.log(`  symbol:      ${values.symbol}`);
  console.log(`  parent:      ${values.parent}`);
  console.log(`  expected TBA: ${values.tba}`);
  console.log(`  tokenId:     ${values.tokenId}`);
  console.log(`  baseUri:     ${values.baseUri}`);

  const hash = await wallet.deployContract({
    abi,
    bytecode: artifact.bytecode,
    args: [values.name, values.symbol, values.parent, values.tba, BigInt(values.tokenId), values.baseUri],
  });
  console.log(`\nTx hash: ${hash}`);
  console.log('Waiting for receipt...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    console.error('Deploy succeeded but contractAddress is null');
    process.exit(1);
  }
  console.log(`\n✓ Deployed at ${receipt.contractAddress}`);

  // Read the gate state to confirm
  const gate = await publicClient.readContract({
    address: receipt.contractAddress,
    abi,
    functionName: 'gateState',
  });
  console.log(`\nGate state:`);
  console.log(`  current parent owner: ${gate[0]}`);
  console.log(`  expected TBA:         ${gate[1]}`);
  console.log(`  gating tokenId:       ${gate[2]}`);
  console.log(`  isOpen:               ${gate[3]}`);

  // Persist
  const out = {
    contractAddress: receipt.contractAddress,
    deployTx: hash,
    deployer: account.address,
    blockNumber: receipt.blockNumber.toString(),
    args: {
      name: values.name,
      symbol: values.symbol,
      parent: values.parent,
      expectedTBA: values.tba,
      gatingTokenId: values.tokenId,
      baseUri: values.baseUri,
    },
    gate: {
      currentParentOwner: gate[0],
      expectedTBA: gate[1],
      gatingTokenId: gate[2].toString(),
      isOpen: gate[3],
    },
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, '..', `deployments-${receipt.contractAddress}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nSaved ${outPath}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
