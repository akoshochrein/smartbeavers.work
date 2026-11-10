// Shared between the SPA and the Worker so the URL players paste into the game
// and the route the Worker serves can't drift apart.

export const WEBHOOK_TOKEN_PATTERN = /^[0-9a-f]{48}$/;
export const MAX_ADAPTER_NAME_LENGTH = 100;

export type AdapterSignal = "on" | "off";

/** URL to paste into an HTTP Adapter's "Call when switched on/off" field. */
export function webhookUrl(origin: string, token: string, signal: AdapterSignal): string {
  // `{name}` is left literal: the game substitutes the adapter's name.
  return `${origin}/hook/${token}/${signal}/{name}`;
}
