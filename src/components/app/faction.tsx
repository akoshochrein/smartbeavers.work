import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { factionLabel, type FactionKey } from "@/shared/goods";

/**
 * How a faction looks wherever a colony is shown to other players. The colours come from the
 * game's buildings, which is what players associate with each faction: golden thatch, cream and
 * dark timber for the Folktails' houses; weathered grey planks over brick red for the Iron
 * Teeth's barracks. The textures are plain stripes, kept faint so text on the panel stays easy
 * to read. A colony with no faction set gets a plain panel.
 */
type FactionLook = {
  /** The panel's own colour. */
  panel: string;
  /** Stripes laid over the panel. */
  texture?: string;
  /** Text on the panel, and quieter text on it. */
  text: string;
  sub: string;
  /** The panel's edge and the faction's name pill, and the text on that pill. */
  accent: string;
  onAccent: string;
};

const LOOKS: Record<FactionKey | "none", FactionLook> = {
  folktails: {
    panel: "#d2ab45",
    texture:
      "repeating-linear-gradient(to bottom, transparent 0 30px, rgba(95,62,10,0.13) 30px 32px), repeating-linear-gradient(98deg, transparent 0 31px, rgba(110,135,40,0.2) 31px 33px), repeating-linear-gradient(98deg, rgba(120,82,12,0.1) 0 1.5px, transparent 1.5px 6px)",
    text: "#2a1f10",
    sub: "#4d3a1c",
    accent: "#4d3720",
    onAccent: "#f6ecd2",
  },
  iron_teeth: {
    panel: "#494c4e",
    texture:
      "linear-gradient(to top, rgba(190,80,35,0.85) 0 7px, transparent 7px), repeating-linear-gradient(101deg, rgba(255,255,255,0.07) 0 12px, rgba(0,0,0,0.11) 12px 14px)",
    text: "#eef3f1",
    sub: "#d5d6d3",
    accent: "#d2602f",
    onAccent: "#1b2422",
  },
  none: { panel: "#3c4a46", text: "#eef3f1", sub: "#c3d2cd", accent: "#a9c4bc", onAccent: "#1b2422" },
};

export function factionLook(faction: string | null | undefined): FactionLook {
  return LOOKS[faction === "folktails" || faction === "iron_teeth" ? faction : "none"];
}

/** Styles for a panel in the faction's look: background, texture and text colour. */
export function factionPanelStyle(faction: string | null | undefined): CSSProperties {
  const look = factionLook(faction);
  return { backgroundColor: look.panel, backgroundImage: look.texture, color: look.text };
}

/** The faction's name in a small pill. `on` says what it sits on: the faction's own panel, or the page. */
export function FactionPill({ faction, on = "panel", className }: { faction: string | null | undefined; on?: "panel" | "page"; className?: string }) {
  const label = factionLabel(faction);
  if (!label) return null;
  const look = factionLook(faction);
  const style = on === "panel" ? { background: look.accent, color: look.onAccent } : { background: look.panel, color: look.text };
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)} style={style}>
      {label}
    </span>
  );
}
