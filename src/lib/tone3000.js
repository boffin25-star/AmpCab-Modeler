// tone3000.js
//
// TONE3000 OAuth 2.0 + PKCE integration - the "Select" flow specifically.
// Per TONE3000's own API terms, a free/non-commercial integration (this
// one) is only permitted to use the Select/Load-Tone OAuth flows plus a
// few bounded list endpoints - NOT the raw /tones/search endpoint. So
// this deliberately does not build a custom search UI: it hands the user
// off to TONE3000's own interface to search/browse, and gets back
// whichever tone they picked.
//
// Docs: https://www.tone3000.com/api
//
// The publishable key below is explicitly safe for client-side code per
// TONE3000's own docs (that's what "publishable" means here) - it's not
// a secret like the t3k_cs_... server key would be.

const PUBLISHABLE_KEY = 't3k_pub_hVbG6dIg_4O1RlQQyDXQEP5CbMXR1__t';
const REDIRECT_URI = 'https://amp-cab-modeler.vercel.app/tone3000-callback';
const API_BASE = 'https://www.tone3000.com/api/v1';

function base64url(bytes) {
  const str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generatePkce() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64url(verifierBytes);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(hash));
  return { verifier, challenge };
}

/** Kick off the Select flow: redirects the whole browser to TONE3000. */
export async function startSelectFlow(extraParams = {}) {
  const { verifier, challenge } = await generatePkce();
  const state = crypto.randomUUID();
  sessionStorage.setItem('t3k_code_verifier', verifier);
  sessionStorage.setItem('t3k_state', state);

  const params = new URLSearchParams({
    client_id: PUBLISHABLE_KEY,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'select_tone',
    ...extraParams, // e.g. { gears: 'amp_pedal' } to scope the catalog
  });

  window.location.href = `${API_BASE}/oauth/authorize?${params}`;
}

/** True if the current URL looks like a TONE3000 OAuth callback. */
export function isOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('error') || params.has('canceled');
}

/**
 * Call this once, on load, when isOAuthCallback() is true. Verifies
 * state, exchanges the code for tokens, and cleans the query params out
 * of the URL so a page refresh doesn't replay the callback.
 */
export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const toneId = params.get('tone_id');
  const canceled = params.get('canceled') === 'true';
  const error = params.get('error');

  window.history.replaceState({}, '', window.location.pathname);

  const expectedState = sessionStorage.getItem('t3k_state');
  if (state !== expectedState) {
    return { ok: false, reason: 'State mismatch — possible CSRF, or an old/stale callback link.' };
  }
  if (error) {
    return { ok: false, reason: `TONE3000 returned an error: ${error}` };
  }
  if (canceled && !code) {
    return { ok: false, canceled: true, reason: 'Canceled before signing in.' };
  }
  if (!code) {
    return { ok: false, reason: 'No authorization code in the callback URL.' };
  }

  const verifier = sessionStorage.getItem('t3k_code_verifier');
  const tokenRes = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
      client_id: PUBLISHABLE_KEY,
    }),
  });

  if (!tokenRes.ok) {
    return { ok: false, reason: `Token exchange failed (${tokenRes.status}).` };
  }

  const tokens = await tokenRes.json();
  storeTokens(tokens);
  return { ok: true, tokens, toneId: toneId ? Number(toneId) : null };
}

function storeTokens(tokens) {
  sessionStorage.setItem('t3k_access_token', tokens.access_token);
  sessionStorage.setItem('t3k_refresh_token', tokens.refresh_token);
  sessionStorage.setItem('t3k_expires_at', String(Date.now() + tokens.expires_in * 1000));
}

async function refreshTokens() {
  const refreshToken = sessionStorage.getItem('t3k_refresh_token');
  if (!refreshToken) throw new Error('No TONE3000 session — sign in first.');

  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: PUBLISHABLE_KEY,
    }),
  });

  if (!res.ok) {
    sessionStorage.removeItem('t3k_access_token');
    sessionStorage.removeItem('t3k_refresh_token');
    sessionStorage.removeItem('t3k_expires_at');
    throw new Error('TONE3000 session expired — sign in again.');
  }

  const tokens = await res.json();
  storeTokens(tokens);
  return tokens.access_token;
}

/** Returns a valid access token, refreshing first if expired. Throws if there's no session. */
export async function getValidAccessToken() {
  const expiresAt = parseInt(sessionStorage.getItem('t3k_expires_at') || '0', 10);
  if (Date.now() > expiresAt) return refreshTokens();
  const token = sessionStorage.getItem('t3k_access_token');
  if (!token) throw new Error('Not signed in to TONE3000 yet.');
  return token;
}

export function isSignedIn() {
  return Boolean(sessionStorage.getItem('t3k_access_token'));
}

/** Fetch a tone's metadata by id. */
export async function getTone(toneId) {
  const token = await getValidAccessToken();
  const res = await fetch(`${API_BASE}/tones/${toneId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Couldn't load tone ${toneId} (${res.status})`);
  return res.json();
}

/** Fetch the list of models for a tone. */
export async function listModels(toneId) {
  const token = await getValidAccessToken();
  const res = await fetch(`${API_BASE}/models?tone_id=${toneId}&page_size=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Couldn't load models for tone ${toneId} (${res.status})`);
  return res.json();
}

/**
 * Download one model's file as a real File object (proper filename +
 * extension), ready to hand straight to library.js's addToLibrary().
 * `format` is the parent tone's format ('nam' or 'ir').
 */
export async function downloadModelAsFile(model, format) {
  const token = await getValidAccessToken();
  const res = await fetch(model.model_url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Couldn't download "${model.name}" (${res.status})`);
  const blob = await res.blob();
  const ext = format === 'ir' ? 'wav' : 'nam';
  const safeName = model.name.replace(/[^\w\- ]/g, '').trim() || `model-${model.id}`;
  return new File([blob], `${safeName}.${ext}`, { type: blob.type });
}
