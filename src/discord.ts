/**
 * Live Discord presence via Lanyard (https://github.com/Phineas/lanyard).
 * Requires the numeric user ID in site.config.json and membership in discord.gg/lanyard.
 */
import { site } from './content';

export type DiscordStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface LanyardActivity {
  id?: string;
  type: number;
  name: string;
  state?: string;
  details?: string;
  application_id?: string;
  emoji?: { name: string; id?: string; animated?: boolean };
  timestamps?: { start?: number; end?: number };
  assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string };
}

export interface LanyardPresence {
  discord_user: { id: string; username: string; global_name?: string | null; display_name?: string | null; avatar: string | null };
  discord_status: DiscordStatus;
  activities: LanyardActivity[];
  listening_to_spotify: boolean;
  spotify: {
    track_id: string | null;
    song: string;
    artist: string;
    album: string;
    album_art_url: string | null;
    timestamps: { start: number; end: number };
  } | null;
}

type Listener = (p: LanyardPresence | null) => void;

const listeners = new Set<Listener>();
let presence: LanyardPresence | null = null;
let started = false;

export const discordEnabled = () => site.discord.enabled && /^\d{17,20}$/.test(site.discord.userId);

function emit(p: LanyardPresence | null) {
  presence = p;
  listeners.forEach((l) => l(p));
}

export function onPresence(fn: Listener) {
  listeners.add(fn);
  fn(presence);
  start();
  return () => listeners.delete(fn);
}

async function poll() {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${site.discord.userId}`);
    const json = await res.json();
    if (json.success) emit(json.data as LanyardPresence);
  } catch {
    /* offline or blocked; keep the last known presence */
  }
}

function start() {
  if (started || !discordEnabled()) return;
  started = true;
  connect(0);
}

function connect(attempt: number) {
  let ws: WebSocket;
  try {
    ws = new WebSocket('wss://api.lanyard.rest/socket');
  } catch {
    fallbackToPolling();
    return;
  }
  let heartbeat = 0;
  let gotData = false;

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data as string) as { op: number; t?: string; d: unknown };
    if (msg.op === 1) {
      const interval = (msg.d as { heartbeat_interval: number }).heartbeat_interval;
      heartbeat = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ op: 3 })), interval);
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: site.discord.userId } }));
    } else if (msg.op === 0 && (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE')) {
      gotData = true;
      emit(msg.d as LanyardPresence);
    }
  });

  ws.addEventListener('close', () => {
    clearInterval(heartbeat);
    if (attempt >= 4 && !gotData) {
      fallbackToPolling();
      return;
    }
    // Back off, then reconnect.
    setTimeout(() => connect(gotData ? 0 : attempt + 1), Math.min(30000, 1000 * 2 ** attempt));
  });
}

function fallbackToPolling() {
  poll();
  setInterval(() => !document.hidden && poll(), 30000);
}

// ───────────────────────── Helpers ─────────────────────────

export function avatarUrl(user: LanyardPresence['discord_user'], size = 128) {
  if (!user.avatar) {
    const index = Number((BigInt(user.id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'webp';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

export function activityImage(a: LanyardActivity): string | null {
  const img = a.assets?.large_image;
  if (!img) return null;
  if (img.startsWith('mp:external/')) return `https://media.discordapp.net/external/${img.slice('mp:external/'.length)}`;
  if (img.startsWith('mp:')) return `https://media.discordapp.net/${img.slice(3)}`;
  if (img.includes(':')) return null; // spotify:, twitch:, etc.
  return a.application_id ? `https://cdn.discordapp.com/app-assets/${a.application_id}/${img}.png` : null;
}

export const activityVerb: Record<number, string> = {
  0: 'Playing',
  1: 'Streaming',
  2: 'Listening to',
  3: 'Watching',
  5: 'Competing in',
};

export const statusLabel: Record<DiscordStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do not disturb',
  offline: 'Offline',
};

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
