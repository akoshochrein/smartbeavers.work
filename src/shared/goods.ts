// Every good a Resource Counter can watch, from timberborn.wiki.gg/wiki/Goods (Nov 2026).
// The wiki page is flagged as partly outdated and spells a few names two ways, so labels may
// differ slightly from the in-game list.

export type GoodGroup = "Fluids" | "Food" | "Ingredients" | "Materials";
export type Faction = "Folktails" | "Iron Teeth";

export type Good = {
  /** Adapter name prefix: the label without spaces, e.g. "TreatedPlanks". Letters only, max 20. */
  prefix: string;
  label: string;
  group: GoodGroup;
  /** Set when only one faction has this good. */
  faction?: Faction;
};

export const GOOD_GROUPS: GoodGroup[] = ["Fluids", "Food", "Ingredients", "Materials"];

/** How a colony's faction is stored (colonies.faction). */
export type FactionKey = "folktails" | "iron_teeth";

export const FACTIONS: { key: FactionKey; label: Faction; hint: string }[] = [
  { key: "folktails", label: "Folktails", hint: "Farmers: bread, carrots, paper" },
  { key: "iron_teeth", label: "Iron Teeth", hint: "Engineers: rations, coffee, metal parts" },
];

export const factionLabel = (key: string | null | undefined): Faction | undefined => FACTIONS.find((f) => f.key === key)?.label;

/** Goods a colony of this faction can have. No faction set: every good. */
export const goodsFor = (key: string | null | undefined): Good[] => {
  const faction = factionLabel(key);
  return faction ? GOODS.filter((g) => !g.faction || g.faction === faction) : GOODS;
};

const F: Faction = "Folktails";
const IT: Faction = "Iron Teeth";

const list = (group: GoodGroup, items: [string, Faction?][]): Good[] =>
  items.map(([label, faction]) => ({ prefix: label.replace(/ /g, ""), label, group, faction }));

export const GOODS: Good[] = [
  ...list("Fluids", [["Water"], ["Badwater"]]),
  ...list("Food", [
    ["Berries"],
    ["Bread", F],
    ["Carrots", F],
    ["Cattail Crackers", F],
    ["Grilled Chestnuts", F],
    ["Grilled Potatoes", F],
    ["Grilled Spadderdock", F],
    ["Maple Pastries", F],
    ["Sunflower Seeds", F],
    ["Algae Rations", IT],
    ["Corn Rations", IT],
    ["Eggplant Rations", IT],
    ["Fermented Cassava", IT],
    ["Fermented Mushrooms", IT],
    ["Fermented Soybeans", IT],
    ["Kohlrabies", IT],
    ["Mangrove Fruits", IT],
  ]),
  ...list("Ingredients", [
    ["Cattail Flour", F],
    ["Cattail Roots", F],
    ["Chestnuts", F],
    ["Maple Syrup", F],
    ["Potatoes", F],
    ["Spadderdock", F],
    ["Wheat", F],
    ["Wheat Flour", F],
    ["Algae", IT],
    ["Canola Oil", IT],
    ["Canola Seeds", IT],
    ["Cassava", IT],
    ["Coffee Beans", IT],
    ["Corn", IT],
    ["Eggplants", IT],
    ["Mushrooms", IT],
    ["Soybeans", IT],
  ]),
  ...list("Materials", [
    ["Logs"],
    ["Planks"],
    ["Treated Planks"],
    ["Gears"],
    ["Scrap Metal"],
    ["Metal Blocks"],
    ["Pine Resin"],
    ["Dirt"],
    ["Extract"],
    ["Explosives"],
    ["Fireworks"],
    ["Bot Chassis"],
    ["Bot Heads"],
    ["Bot Limbs"],
    ["Paper", F],
    ["Books", F],
    ["Punch Cards", F],
    ["Dandelions", F],
    ["Antidotes", F],
    ["Biofuel", F],
    ["Catalyst", F],
    ["Metal Parts", IT],
    ["Grease", IT],
    ["Coffee", IT],
  ]),
];
