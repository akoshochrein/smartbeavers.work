import { createFileRoute } from "@tanstack/react-router";
import { COLONY_TABS, ColonyPage, type ColonyTab } from "@/pages/Colony";

export const Route = createFileRoute("/_app/colonies/$id/")({
  // ?tab=signals and so on. The default tab (trackers) has no parameter.
  validateSearch: (search: Record<string, unknown>): { tab?: ColonyTab } => {
    const tab = COLONY_TABS.find((t) => t === search.tab);
    return tab && tab !== "trackers" ? { tab } : {};
  },
  component: ColonyPage,
});
