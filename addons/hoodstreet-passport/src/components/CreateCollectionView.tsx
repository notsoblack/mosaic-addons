/**
 * HoodStreet Passport v0.2 — Create Collection sub-view.
 *
 * Walks the user through 4 steps to deploy a new sub-collection:
 *   1. Collection metadata (name, symbol)
 *   2. Gating config (which parent CCFF00 tokenId, which TBA address)
 *   3. Base URI / metadata strategy
 *   4. Review + deploy (caller signs in their Robinhood Wallet)
 *
 * After deploy, the new contract address is shown and the user is
 * offered the choice to mint the first sub-passport immediately.
 */

import { useState } from 'react';
import type { AddonAPI } from '../types/addonApi';
import { HOODSTREET_DEPLOYMENT } from '../lib/viem';
import {
  readGateState,
  signAndBroadcastDeploy,
  type DeployArgs,
  type GateState,
} from '../lib/contractDeploy';
import { HOODSTREET_MEMBER_PASSPORT_ABI } from '../lib/contractTemplate';
import { writeJson } from '../lib/persistence';

interface Props {
  api: AddonAPI | undefined;
  bridgeReady: boolean;
}

type Step = 'metadata' | 'gating' | 'baseUri' | 'review' | 'deploying' | 'done';

interface FormState {
  name: string;
  symbol: string;
  parentContract: string;
  expectedTBA: string;
  gatingTokenId: string;
  initialBaseURI: string;
}

const DEFAULT_FORM: FormState = {
  name: 'HoodStreet Member Passport',
  symbol: 'HSMP',
  parentContract: HOODSTREET_DEPLOYMENT.parentNft,
  expectedTBA: '',
  gatingTokenId: '',
  initialBaseURI: 'ipfs://',
};

export function CreateCollectionView({ api, bridgeReady }: Props) {
  const [step, setStep] = useState<Step>('metadata');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [gate, setGate] = useState<GateState | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function deploy() {
    setError(null);
    setStep('deploying');
    try {
      // The bytecode would normally come from scripts/compile-contract.ts output.
      // For the proof-of-concept, we require the user to paste it in.
      const bytecode = localStorage.getItem('hoodstreet-passport:contractBytecode') as `0x${string}` | null;
      if (!bytecode || bytecode === '0x' || bytecode.length < 100) {
        throw new Error(
          'Contract bytecode not found. Run `npm run build:contract` to compile, ' +
          'then paste the bytecode into the Base URI step.'
        );
      }
      const args: DeployArgs = {
        name: form.name,
        symbol: form.symbol,
        parentContract: form.parentContract as `0x${string}`,
        expectedTBA: form.expectedTBA as `0x${string}`,
        gatingTokenId: BigInt(form.gatingTokenId),
        initialBaseURI: form.initialBaseURI,
      };
      const result = await signAndBroadcastDeploy(args, bytecode);
      setTxHash(result.hash);
      setContractAddress(result.contractAddress);
      // Persist the deployment so the user can refer to it later
      await writeJson(api, `deployments/${result.contractAddress}.json`, {
        deployedAt: new Date().toISOString(),
        contractAddress: result.contractAddress,
        txHash: result.hash,
        ...args,
        gatingTokenId: form.gatingTokenId,  // keep as string
      });
      // Read the gate state to confirm
      const gs = await readGateState(result.contractAddress as `0x${string}`);
      setGate(gs);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setStep('review');
    }
  }

  return (
    <div className="space-y-4">
      <Stepper step={step} />

      {step === 'metadata' && (
        <Card title="1. Collection metadata">
          <Field label="Name" value={form.name} onChange={(v) => update('name', v)} placeholder="HoodStreet Member Passport" />
          <Field label="Symbol" value={form.symbol} onChange={(v) => update('symbol', v)} placeholder="HSMP" />
          <p className="text-xs text-mosaic-textMuted mt-1">ERC-721 standard. Use a short, all-caps symbol (3-5 chars).</p>
          <Nav onNext={() => setStep('gating')} canNext={form.name.length > 0 && form.symbol.length > 0} />
        </Card>
      )}

      {step === 'gating' && (
        <Card title="2. Gating configuration">
          <p className="text-xs text-mosaic-textMuted mb-3 leading-relaxed">
            The sub-collection will be mintable only while the specified parent CCFF00 tokenId is held by the
            specified TBA address. This is the onchain gate — once the parent CCFF00 transfers to a different TBA, the
            gate closes automatically.
          </p>
          <Field label="Parent CCFF00 contract" value={form.parentContract} onChange={(v) => update('parentContract', v)} />
          <Field label="Gating CCFF00 tokenId" value={form.gatingTokenId} onChange={(v) => update('gatingTokenId', v.replace(/[^0-9]/g, ''))} placeholder="e.g. 7980" />
          <Field label="Expected TBA of that tokenId" value={form.expectedTBA} onChange={(v) => update('expectedTBA', v)} placeholder="0x..." />
          <p className="text-xs text-mosaic-warning mt-1">
            ⚠ Use the live TBA from the HoodStreet MCP, not the parent EOA. The gate checks the TBA, not the human
            wallet.
          </p>
          <Nav onBack={() => setStep('metadata')} onNext={() => setStep('baseUri')} canNext={form.gatingTokenId.length > 0 && form.expectedTBA.startsWith('0x')} />
        </Card>
      )}

      {step === 'baseUri' && (
        <Card title="3. Base URI">
          <Field label="Initial base URI" value={form.initialBaseURI} onChange={(v) => update('initialBaseURI', v)} placeholder="ipfs://QmYourCID/ or https://your-metadata.com/" />
          <p className="text-xs text-mosaic-textMuted mt-1 leading-relaxed">
            Each token's metadata resolves to <code className="text-mosaic-primary">{form.initialBaseURI}1.json</code>,
            <code className="text-mosaic-primary">2.json</code>, etc. You can update this later via the owner's
            <code className="text-mosaic-primary">setBaseURI</code> function.
          </p>
          <Nav onBack={() => setStep('gating')} onNext={() => setStep('review')} canNext={form.initialBaseURI.length > 0} />
        </Card>
      )}

      {step === 'review' && (
        <Card title="4. Review + deploy">
          <pre className="text-xs text-mosaic-text font-mono bg-mosaic-bg p-3 rounded-md overflow-auto leading-relaxed">
{JSON.stringify({
  name: form.name,
  symbol: form.symbol,
  parentContract: form.parentContract,
  expectedTBA: form.expectedTBA,
  gatingTokenId: form.gatingTokenId,
  initialBaseURI: form.initialBaseURI,
}, null, 2)}
          </pre>
          {error && <ErrorBox message={error} />}
          <Nav onBack={() => setStep('baseUri')} onNext={deploy} canNext={true} nextLabel="Sign + deploy" />
        </Card>
      )}

      {step === 'deploying' && (
        <Card title="5. Deploying…">
          <p className="text-sm text-mosaic-textMuted leading-relaxed">
            Check your Robinhood Wallet (or MetaMask). Sign the deploy transaction. Once it's mined, the new
            contract address will appear below.
          </p>
        </Card>
      )}

      {step === 'done' && contractAddress && (
        <Card title="✓ Deployed" accent>
          <p className="text-sm text-mosaic-text leading-relaxed">
            Your sub-collection is live at:
          </p>
          <pre className="text-xs text-mosaic-primary font-mono bg-mosaic-bg p-2 rounded mt-1 break-all">
{contractAddress}
          </pre>
          {gate && (
            <div className="mt-3 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-mosaic-textMuted">Gate</span>
                <span className={gate.parentHeld && gate.tbaOwner.toLowerCase() === gate.expectedTBA.toLowerCase() ? 'text-mosaic-success' : 'text-mosaic-warning'}>
                  {gate.parentHeld && gate.tbaOwner.toLowerCase() === gate.expectedTBA.toLowerCase() ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-mosaic-textMuted">Parent owner</span>
                <span className="font-mono text-mosaic-text">{gate.currentParentOwner}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-mosaic-textMuted">TBA owner</span>
                <span className="font-mono text-mosaic-text">{gate.tbaOwner}</span>
              </div>
            </div>
          )}
          {txHash && (
            <a
              href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
              onClick={(e) => { e.preventDefault(); if (api?.ui?.openExternal) void api.ui.openExternal(`https://robinhoodchain.blockscout.com/tx/${txHash}`); }}
              className="text-xs text-mosaic-primary hover:underline mt-2 inline-block"
            >
              View on Blockscout ↗
            </a>
          )}
          <p className="text-xs text-mosaic-textMuted mt-3 leading-relaxed">
            Next steps: open the Gated Mint sub-view to mint your first sub-passport, or share the contract address
            with anyone who holds the gating CCFF00.
          </p>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'metadata', label: 'Metadata' },
    { key: 'gating', label: 'Gating' },
    { key: 'baseUri', label: 'Base URI' },
    { key: 'review', label: 'Review' },
    { key: 'deploying', label: 'Deploying' },
    { key: 'done', label: 'Done' },
  ];
  return (
    <div className="flex items-center gap-1 mb-3">
      {steps.map((s, i) => {
        const idx = steps.findIndex((x) => x.key === step);
        const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
        return (
          <div key={s.key} className="flex items-center">
            <div className={`px-2 py-1 text-xs rounded ${state === 'done' ? 'bg-mosaic-success/20 text-mosaic-success' : state === 'active' ? 'bg-mosaic-primary/20 text-mosaic-primary' : 'text-mosaic-muted'}`}>
              {i + 1}. {s.label}
            </div>
            {i < steps.length - 1 && <div className="w-3 h-px bg-mosaic-border mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${accent ? 'border-hoodstreet/40 bg-mosaic-surface' : 'border-mosaic-border bg-mosaic-surface'}`}>
      <h2 className={`text-sm font-semibold mb-3 ${accent ? 'text-hoodstreet' : 'text-mosaic-text'}`}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-mosaic-textMuted mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text placeholder:text-mosaic-muted focus:outline-none focus:border-mosaic-primary font-mono text-xs"
      />
    </label>
  );
}

function Nav({ onBack, onNext, canNext, nextLabel = 'Next' }: { onBack?: () => void; onNext: () => void; canNext: boolean; nextLabel?: string }) {
  return (
    <div className="flex justify-between pt-3 border-t border-mosaic-border mt-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="px-3 py-1.5 text-xs text-mosaic-textMuted hover:text-mosaic-text">← Back</button>
      ) : <span />}
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="px-4 py-1.5 rounded-md bg-mosaic-primary text-mosaic-bg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-3 p-3 rounded-md border border-mosaic-danger/50 bg-mosaic-danger/10 text-mosaic-danger text-xs">
      {message}
    </div>
  );
}
