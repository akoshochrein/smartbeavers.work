import { createFileRoute } from "@tanstack/react-router";
import { WeatherGuide } from "@/pages/WeatherGuide";

export const Route = createFileRoute("/_app/colonies/$id/trackers/weather")({ component: WeatherGuide });
