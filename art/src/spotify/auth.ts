/**
 * Spotify Web API auth via Authorization Code + PKCE.
 *
 * Public client, no secret leaks. Token + refresh stored in localStorage,
 * refreshed on demand. Setup: register an app at
 * https://developer.spotify.com/dashboard, set redirect URI to
 * `http://127.0.0.1:5173/` (or whatever the dev server uses), drop the
 * client ID in `.env.local` as VITE_SPOTIFY_CLIENT_ID, and ensure your
 * Spotify account is Premium (Playback SDK requires it).
 */

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const REDIRECT_URI = window.location.origin + "/";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
].join(" ");

const STORAGE = {
  verifier: "innerprint.pkce_verifier",
  token: "innerprint.token",
  expires: "innerprint.token_expires",
  refresh: "innerprint.refresh",
} as const;

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateVerifier(): Promise<string> {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

async function generateChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

export function hasClientId(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.length > 0);
}

export async function login(): Promise<void> {
  if (!CLIENT_ID) {
    alert(
      "Spotify CLIENT_ID missing. Set VITE_SPOTIFY_CLIENT_ID in art/.env.local",
    );
    return;
  }
  const verifier = await generateVerifier();
  const challenge = await generateChallenge(verifier);
  localStorage.setItem(STORAGE.verifier, verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCode(code: string): Promise<string | null> {
  if (!CLIENT_ID) return null;
  const verifier = localStorage.getItem(STORAGE.verifier);
  if (!verifier) return null;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await r.json();
  if (!data.access_token) {
    console.warn("token exchange failed", data);
    return null;
  }
  storeToken(data);
  return data.access_token as string;
}

function storeToken(data: {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}) {
  localStorage.setItem(STORAGE.token, data.access_token);
  localStorage.setItem(
    STORAGE.expires,
    String(Date.now() + (data.expires_in - 30) * 1000),
  );
  if (data.refresh_token) localStorage.setItem(STORAGE.refresh, data.refresh_token);
}

async function refresh(): Promise<string | null> {
  if (!CLIENT_ID) return null;
  const refreshToken = localStorage.getItem(STORAGE.refresh);
  if (!refreshToken) return null;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await r.json();
  if (!data.access_token) return null;
  storeToken(data);
  return data.access_token as string;
}

/**
 * Call on app startup. If we just came back from the auth redirect, finish
 * the token exchange. Otherwise, return any cached token (refreshing if
 * needed). Returns null if user has never logged in.
 */
export async function resolveToken(): Promise<string | null> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const t = await exchangeCode(code);
    window.history.replaceState({}, document.title, REDIRECT_URI);
    return t;
  }
  const cached = localStorage.getItem(STORAGE.token);
  const expires = parseInt(localStorage.getItem(STORAGE.expires) ?? "0");
  if (cached && Date.now() < expires) return cached;
  if (localStorage.getItem(STORAGE.refresh)) return refresh();
  return null;
}

export function logout(): void {
  for (const k of Object.values(STORAGE)) localStorage.removeItem(k);
}
