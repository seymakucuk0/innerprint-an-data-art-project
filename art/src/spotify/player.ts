/**
 * Wrapper around Spotify Web Playback SDK.
 *
 * Requires Premium. SDK is loaded from CDN via index.html; this module
 * waits for `window.Spotify` to exist, creates a Player named
 * 'innerprint', transfers playback to its device, and exposes a single
 * `playTrack(artist, track)` that searches the catalogue and starts it.
 */

type SpotifyPlayer = {
  addListener: (event: string, cb: (data: any) => void) => void;
  removeListener?: (event: string, cb?: (data: any) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: { Player: new (opts: any) => SpotifyPlayer };
  }
}

let player: SpotifyPlayer | null = null;
let deviceId: string | null = null;
let ready: Promise<string> | null = null;

function waitForSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      prev?.();
      resolve();
    };
  });
}

export async function ensurePlayer(getToken: () => string | null): Promise<string> {
  if (deviceId) return deviceId;
  if (ready) return ready;
  ready = (async () => {
    await waitForSdk();
    const t = getToken();
    if (!t) throw new Error("no token");
    return new Promise<string>((resolve, reject) => {
      const p = new window.Spotify!.Player({
        name: "innerprint",
        getOAuthToken: (cb: (token: string) => void) => {
          const cur = getToken();
          if (cur) cb(cur);
        },
        volume: 0.55,
      });
      p.addListener("ready", async ({ device_id }: { device_id: string }) => {
        deviceId = device_id;
        // hand playback to this device but don't auto-start
        await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch(() => {});
        resolve(device_id);
      });
      p.addListener("initialization_error", ({ message }: any) =>
        reject(new Error("init: " + message)),
      );
      p.addListener("authentication_error", ({ message }: any) =>
        reject(new Error("auth: " + message)),
      );
      p.addListener("account_error", ({ message }: any) =>
        reject(new Error("account (Premium required): " + message)),
      );
      player = p;
      p.connect();
    });
  })();
  return ready;
}

export async function searchTrackUri(
  token: string,
  artist: string,
  track: string,
): Promise<string | null> {
  // try a strict search first; fall back to loose if no match
  for (const query of [
    `track:"${track}" artist:"${artist}"`,
    `${track} ${artist}`,
  ]) {
    const r = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) continue;
    const data = await r.json();
    const uri = data?.tracks?.items?.[0]?.uri;
    if (uri) return uri as string;
  }
  return null;
}

export async function playUri(
  token: string,
  uri: string,
  positionMs = 0,
): Promise<boolean> {
  if (!deviceId) return false;
  const body: { uris: string[]; position_ms?: number } = { uris: [uri] };
  if (positionMs > 0) body.position_ms = Math.round(positionMs);
  const r = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  return r.ok;
}

/**
 * Use Spotify's own audio-analysis to estimate where the chorus / hook
 * starts. Heuristic: among sections that are long enough to be a real
 * passage (≥ 6 s) and aren't the very intro, take the loudest one;
 * fall back to the loudest of any section, then to 0.
 */
export async function getChorusStartMs(
  token: string,
  uri: string,
): Promise<number> {
  const trackId = uri.split(":").pop();
  if (!trackId) return 0;
  const r = await fetch(
    `https://api.spotify.com/v1/audio-analysis/${trackId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) return 0;
  const data = await r.json();
  const sections: Array<{ start: number; duration: number; loudness: number }> =
    data?.sections ?? [];
  if (sections.length === 0) return 0;

  const introEnd = sections[0]?.duration ?? 0;
  const longEnough = sections.filter(
    (s) => s.duration >= 6 && s.start >= introEnd * 0.5,
  );
  const pool = longEnough.length > 0 ? longEnough : sections;
  const best = pool.reduce((a, b) =>
    b.loudness > a.loudness ||
    (b.loudness === a.loudness && b.duration > a.duration)
      ? b
      : a,
  );
  return Math.max(0, Math.round(best.start * 1000));
}

export function formatMs(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function togglePlayPause(): Promise<void> {
  if (player) await player.togglePlay();
}

export function disconnectPlayer(): void {
  player?.disconnect();
  player = null;
  deviceId = null;
  ready = null;
}
