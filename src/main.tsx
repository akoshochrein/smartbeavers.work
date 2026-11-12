import { MotionConfig } from "motion/react";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./index.css";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { AuthCallback } from "./pages/AuthCallback";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";

// Signed-in pages load on demand so the public landing page stays light.
const AppShell = lazy(() => import("@/components/app/AppShell").then((m) => ({ default: m.AppShell })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const ColonyPage = lazy(() => import("./pages/Colony").then((m) => ({ default: m.ColonyPage })));
const TrackerNew = lazy(() => import("./pages/TrackerNew").then((m) => ({ default: m.TrackerNew })));
const TrackerGuide = lazy(() => import("./pages/TrackerGuide").then((m) => ({ default: m.TrackerGuide })));
const WeatherGuide = lazy(() => import("./pages/WeatherGuide").then((m) => ({ default: m.WeatherGuide })));
const Account = lazy(() => import("./pages/Account").then((m) => ({ default: m.Account })));
const ClockGuide = lazy(() => import("./pages/ClockGuide").then((m) => ({ default: m.ClockGuide })));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<div className="min-h-dvh bg-mist" aria-busy="true" />}>
            <Routes>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="auth/callback" element={<AuthCallback />} />
              <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="account" element={<Account />} />
                <Route path="colonies/:id" element={<ColonyPage />} />
                <Route path="colonies/:id/trackers/new" element={<TrackerNew />} />
                <Route path="colonies/:id/trackers/weather" element={<WeatherGuide />} />
                <Route path="colonies/:id/trackers/clock" element={<ClockGuide />} />
                <Route path="colonies/:id/trackers/:ladderId" element={<TrackerGuide />} />
              </Route>
            </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
      <Toaster position="bottom-right" richColors={false} />
    </MotionConfig>
  </StrictMode>,
);
