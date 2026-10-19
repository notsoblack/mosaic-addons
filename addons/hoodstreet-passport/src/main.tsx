/**
 * HoodStreet Passport — main entry
 *
 * Resolves addonAPI (if present), picks up deep-link params from
 * window.location.search, and mounts the App.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import type { AddonAPI } from './types/addonApi';
import './index.css';

const params = new URLSearchParams(window.location.search);
const initialTokenId = params.get('tokenId') ?? undefined;

const api: AddonAPI | undefined = window.addonAPI;

const root = document.getElementById('root');
if (!root) {
  throw new Error('HoodStreet Passport: #root element missing');
}

createRoot(root).render(
  <StrictMode>
    <App api={api} initialTokenId={initialTokenId} />
  </StrictMode>,
);
