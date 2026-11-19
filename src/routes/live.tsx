import { createFileRoute } from "@tanstack/react-router";
import { Ladder } from "@/pages/Ladder";

export const Route = createFileRoute("/live")({ component: Ladder });
