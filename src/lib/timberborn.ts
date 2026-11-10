// Client for Timberborn's built-in HTTP API (HTTP Lever / HTTP Adapter buildings).
//
// The game serves this on the player's own machine (default http://localhost:8080),
// so it is called from the *browser*, never from the Worker.
//
// Endpoints (all GET), per https://timberborn.wiki.gg/wiki/HTTP_API:
//   /api/levers                     -> Lever[]
//   /api/levers/<name>              -> Lever
//   /api/adapters                   -> Adapter[]
//   /api/adapters/<name>            -> Adapter
//   /api/switch-on/<lever>
//   /api/switch-off/<lever>
//   /api/color/<lever>/<hex>
// Names are case sensitive and must be URL-encoded.

export const DEFAULT_GAME_API_URL = "http://localhost:8080";

export type Lever = { name: string; state: boolean; springReturn: boolean };
export type Adapter = { name: string; state: boolean };

export class GameUnreachableError extends Error {
  constructor(baseUrl: string) {
    super(
      `Couldn't reach Timberborn at ${baseUrl}. Is the game running with an HTTP Lever or Adapter built, ` +
        `and did your browser allow local network access for this site?`,
    );
  }
}

/** "confirmed" = the game answered; "sent" = delivered but the response was unreadable (CORS). */
export type CommandResult = "confirmed" | "sent";

export function createGameClient(baseUrl: string = DEFAULT_GAME_API_URL) {
  const base = baseUrl.replace(/\/+$/, "");
  const enc = encodeURIComponent;

  async function read<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(base + path, { cache: "no-store" });
    } catch {
      throw new GameUnreachableError(base);
    }
    if (!res.ok) throw new Error(`Timberborn API ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  // Commands are plain GETs with side effects. If the game doesn't send CORS headers we
  // can still deliver them as opaque `no-cors` requests; we just can't see the response.
  async function command(path: string): Promise<CommandResult> {
    try {
      const res = await fetch(base + path, { cache: "no-store" });
      if (!res.ok) throw new Error(`Timberborn API ${path} → ${res.status}`);
      return "confirmed";
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      try {
        await fetch(base + path, { cache: "no-store", mode: "no-cors" });
        return "sent";
      } catch {
        throw new GameUnreachableError(base);
      }
    }
  }

  return {
    baseUrl: base,
    levers: () => read<Lever[]>("/api/levers"),
    lever: (name: string) => read<Lever>(`/api/levers/${enc(name)}`),
    adapters: () => read<Adapter[]>("/api/adapters"),
    adapter: (name: string) => read<Adapter>(`/api/adapters/${enc(name)}`),
    switchOn: (lever: string) => command(`/api/switch-on/${enc(lever)}`),
    switchOff: (lever: string) => command(`/api/switch-off/${enc(lever)}`),
    setColor: (lever: string, hex: string) =>
      command(`/api/color/${enc(lever)}/${enc(hex.replace(/^#/, ""))}`),
  };
}

export type GameClient = ReturnType<typeof createGameClient>;
