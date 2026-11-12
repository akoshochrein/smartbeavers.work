import { createFileRoute } from "@tanstack/react-router";
import { TrackerGuide } from "@/pages/TrackerGuide";

export const Route = createFileRoute("/_app/colonies/$id/trackers/$ladderId")({ component: TrackerGuide });
