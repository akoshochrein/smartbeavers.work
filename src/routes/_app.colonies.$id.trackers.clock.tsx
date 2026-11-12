import { createFileRoute } from "@tanstack/react-router";
import { ClockGuide } from "@/pages/ClockGuide";

export const Route = createFileRoute("/_app/colonies/$id/trackers/clock")({ component: ClockGuide });
